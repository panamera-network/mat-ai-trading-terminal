//+------------------------------------------------------------------+
//|                                              MATai_Bridge.mq5    |
//|                        MAT.ai Trading Terminal - MT5 Bridge      |
//|                        Native MQL5 Socket (No JSON Class)        |
//+------------------------------------------------------------------+
#property copyright "MAT.ai"
#property link      "https://mat.ai"
#property version   "2.0"
#property strict

//--- Input Parameters
input string   InpServerHost = "127.0.0.1";    // Server Host
input int      InpServerPort = 5555;           // Server Port
input int      InpReconnectInterval = 5000;    // Reconnect Interval (ms)
input int      InpHeartbeatInterval = 30000;   // Heartbeat Interval (ms)
input int      InpTickInterval = 100;          // Tick Send Interval (ms)
input int      InpSocketTimeout = 5000;        // Socket Timeout (ms)
input string   InpSymbols = "EURUSD,GBPUSD,USDJPY,AUDUSD,USDCAD"; // Symbols to stream
input int      InpHistoryBars = 500;           // History bars to send on connect
input bool     InpDebugMode = false;           // Debug Mode

//--- Socket Handle
int g_socket = INVALID_HANDLE;
bool g_connected = false;
datetime g_lastReconnect = 0;
datetime g_lastHeartbeat = 0;
uint g_lastTickSend = 0;

//--- Symbol tracking
string g_symbols[];
int g_symbolCount = 0;

//--- Rate limiters
datetime g_lastBarTime[];
bool g_newBar[];

//--- Buffer for incoming commands
string g_recvBuffer = "";

//--- Magic number for orders
#define MATAI_MAGIC 20240724

//+------------------------------------------------------------------+
//| Expert initialization function                                     |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("=== MAT.ai Bridge v2.0 Starting ===");
   Print("Server: ", InpServerHost, ":", InpServerPort);
   
   // Parse symbols
   ParseSymbols();
   
   // Initialize arrays
   ArrayResize(g_lastBarTime, g_symbolCount);
   ArrayResize(g_newBar, g_symbolCount);
   for(int i = 0; i < g_symbolCount; i++)
   {
      g_lastBarTime[i] = 0;
      g_newBar[i] = false;
   }
   
   // Subscribe to all symbols
   for(int i = 0; i < g_symbolCount; i++)
   {
      if(!SymbolSelect(g_symbols[i], true))
      {
         Print("Failed to select symbol: ", g_symbols[i]);
      }
      else
      {
         Print("Subscribed to: ", g_symbols[i]);
      }
   }
   
   // Initial connection attempt
   if(!ConnectToServer())
   {
      Print("Initial connection failed, will retry...");
   }
   
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                   |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   Print("=== MAT.ai Bridge Shutting Down ===");
   DisconnectFromServer();
}

//+------------------------------------------------------------------+
//| Expert tick function                                               |
//+------------------------------------------------------------------+
void OnTick()
{
   // Check connection and reconnect if needed
   if(!g_connected)
   {
      datetime now = TimeLocal();
      if(now - g_lastReconnect >= InpReconnectInterval / 1000)
      {
         ConnectToServer();
         g_lastReconnect = now;
      }
      return;
   }
   
   // Send heartbeat
   datetime now = TimeLocal();
   if(now - g_lastHeartbeat >= InpHeartbeatInterval / 1000)
   {
      SendHeartbeat();
      g_lastHeartbeat = now;
   }
   
   // Process incoming commands
   ProcessIncomingCommands();
   
   // Send tick data for all symbols (rate limited)
   if(GetTickCount() - g_lastTickSend >= (uint)InpTickInterval)
   {
      SendTickData();
      g_lastTickSend = GetTickCount();
   }
   
   // Check for new bars and send
   CheckNewBars();
   
   // Send account info periodically
   static datetime lastAccountSend = 0;
   if(now - lastAccountSend >= 5) // Every 5 seconds
   {
      SendAccountInfo();
      lastAccountSend = now;
   }
}

//+------------------------------------------------------------------+
//| Parse comma-separated symbols                                      |
//+------------------------------------------------------------------+
void ParseSymbols()
{
   string sym = InpSymbols;
   string sep = ",";
   ushort u_sep = StringGetCharacter(sep, 0);
   
   string result[];
   int k = StringSplit(sym, u_sep, result);
   
   if(k > 0)
   {
      g_symbolCount = k;
      ArrayResize(g_symbols, g_symbolCount);
      for(int i = 0; i < k; i++)
      {
         g_symbols[i] = result[i];
         Print("Symbol[", i, "]: ", g_symbols[i]);
      }
   }
}

//+------------------------------------------------------------------+
//| Connect to Node.js server                                          |
//+------------------------------------------------------------------+
bool ConnectToServer()
{
   if(g_socket != INVALID_HANDLE)
   {
      SocketClose(g_socket);
      g_socket = INVALID_HANDLE;
   }
   
   Print("Connecting to ", InpServerHost, ":", InpServerPort, "...");
   
   g_socket = SocketCreate();
   if(g_socket == INVALID_HANDLE)
   {
      Print("SocketCreate failed: ", GetLastError());
      return false;
   }
   
   // Set socket options
   SocketTimeouts(g_socket, InpSocketTimeout, InpSocketTimeout);
   
   // SocketConnect needs 4 params in some builds: socket, host, port, timeout
   if(!SocketConnect(g_socket, InpServerHost, InpServerPort, InpSocketTimeout))
   {
      int err = GetLastError();
      Print("SocketConnect failed: ", err);
      SocketClose(g_socket);
      g_socket = INVALID_HANDLE;
      return false;
   }
   
   g_connected = true;
   Print("Connected to server!");
   
   // Send initial handshake
   SendHandshake();
   
   // Send historical data for all symbols
   for(int i = 0; i < g_symbolCount; i++)
   {
      SendHistory(g_symbols[i]);
   }
   
   return true;
}

//+------------------------------------------------------------------+
//| Disconnect from server                                             |
//+------------------------------------------------------------------+
void DisconnectFromServer()
{
   if(g_socket != INVALID_HANDLE)
   {
      if(g_connected)
      {
         // Send disconnect message
         string msg = "{\"type\":\"disconnect\",\"reason\":\"shutdown\"}\n";
         SendString(msg);
      }
      
      SocketClose(g_socket);
      g_socket = INVALID_HANDLE;
   }
   g_connected = false;
   Print("Disconnected from server");
}

//+------------------------------------------------------------------+
//| Send string over socket                                            |
//+------------------------------------------------------------------+
bool SendString(string msg)
{
   if(g_socket == INVALID_HANDLE || !g_connected)
      return false;
   
   uchar data[];  // <-- was char[], change to uchar[]
   int len = StringLen(msg);
   ArrayResize(data, len);
   for(int i = 0; i < len; i++)
   {
      data[i] = (uchar)StringGetCharacter(msg, i);
   }
   
   int sent = SocketSend(g_socket, data, len);
   if(sent <= 0)
   {
      int err = GetLastError();
      Print("SocketSend failed: ", err);
      g_connected = false;
      return false;
   }
   
   if(InpDebugMode)
      Print("SENT: ", msg);
   
   return true;
}

//+------------------------------------------------------------------+
//| Send handshake message                                             |
//+------------------------------------------------------------------+
void SendHandshake()
{
   string json = "{";
   json += "\"type\":\"handshake\",";
   json += "\"platform\":\"MT5\",";
   json += "\"version\":\"2.0\",";
   json += "\"account\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   json += "\"broker\":\"" + EscapeJson(AccountInfoString(ACCOUNT_COMPANY)) + "\",";
   json += "\"symbols\":[" + SymbolsToJson() + "]";
   json += "}\n";
   
   SendString(json);
   Print("Handshake sent");
}

//+------------------------------------------------------------------+
//| Send heartbeat                                                     |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   string json = "{";
   json += "\"type\":\"heartbeat\",";
   json += "\"timestamp\":\"" + IntegerToString(TimeLocal()) + "\",";
   json += "\"uptime\":\"" + IntegerToString(GetTickCount()) + "\"";
   json += "}\n";
   
   SendString(json);
}

//+------------------------------------------------------------------+
//| Send tick data for all symbols                                     |
//+------------------------------------------------------------------+
void SendTickData()
{
   for(int i = 0; i < g_symbolCount; i++)
   {
      MqlTick tick;
      if(!SymbolInfoTick(g_symbols[i], tick))
         continue;
      
      string json = "{";
      json += "\"type\":\"tick\",";
      json += "\"symbol\":\"" + g_symbols[i] + "\",";
      json += "\"bid\":\"" + DoubleToString(tick.bid, _Digits) + "\",";
      json += "\"ask\":\"" + DoubleToString(tick.ask, _Digits) + "\",";
      json += "\"last\":\"" + DoubleToString(tick.last, _Digits) + "\",";
      json += "\"volume\":\"" + IntegerToString(tick.volume) + "\",";
      json += "\"time\":\"" + IntegerToString(tick.time) + "\",";
      json += "\"time_msc\":\"" + IntegerToString(tick.time_msc) + "\",";
      json += "\"flags\":\"" + IntegerToString(tick.flags) + "\"";
      json += "}\n";
      
      SendString(json);
   }
}

//+------------------------------------------------------------------+
//| Check for new bars and send OHLCV                                  |
//+------------------------------------------------------------------+
void CheckNewBars()
{
   for(int i = 0; i < g_symbolCount; i++)
   {
      datetime currentBarTime = iTime(g_symbols[i], PERIOD_CURRENT, 0);
      
      if(currentBarTime != g_lastBarTime[i])
      {
         if(g_lastBarTime[i] != 0) // Skip first run
         {
            SendBarData(g_symbols[i], 1); // Send completed bar
         }
         g_lastBarTime[i] = currentBarTime;
         g_newBar[i] = true;
      }
      else if(g_newBar[i])
      {
         // Send forming bar updates
         SendBarData(g_symbols[i], 0);
      }
   }
}

//+------------------------------------------------------------------+
//| Send bar (OHLCV) data                                              |
//+------------------------------------------------------------------+
void SendBarData(string symbol, int index)
{
   MqlRates rates[];
   int copied = CopyRates(symbol, PERIOD_CURRENT, index, 1, rates);
   if(copied < 1) return;
   
   string json = "{";
   json += "\"type\":\"bar\",";
   json += "\"symbol\":\"" + symbol + "\",";
   json += "\"timeframe\":\"" + TimeframeToString(PERIOD_CURRENT) + "\",";
   json += "\"time\":\"" + IntegerToString(rates[0].time) + "\",";
   json += "\"open\":\"" + DoubleToString(rates[0].open, _Digits) + "\",";
   json += "\"high\":\"" + DoubleToString(rates[0].high, _Digits) + "\",";
   json += "\"low\":\"" + DoubleToString(rates[0].low, _Digits) + "\",";
   json += "\"close\":\"" + DoubleToString(rates[0].close, _Digits) + "\",";
   json += "\"tick_volume\":\"" + IntegerToString(rates[0].tick_volume) + "\",";
   json += "\"real_volume\":\"" + IntegerToString(rates[0].real_volume) + "\",";
   json += "\"spread\":\"" + IntegerToString(rates[0].spread) + "\",";
   json += "\"isForming\":" + ((index == 0) ? "true" : "false");
   json += "}\n";
   
   SendString(json);
}

//+------------------------------------------------------------------+
//| Send historical data                                               |
//+------------------------------------------------------------------+
void SendHistory(string symbol)
{
   MqlRates rates[];
   int copied = CopyRates(symbol, PERIOD_CURRENT, 1, InpHistoryBars, rates);
   if(copied < 1)
   {
      Print("Failed to copy history for ", symbol);
      return;
   }
   
   Print("Sending ", copied, " historical bars for ", symbol);
   
   for(int i = copied - 1; i >= 0; i--)
   {
      string json = "{";
      json += "\"type\":\"history\",";
      json += "\"symbol\":\"" + symbol + "\",";
      json += "\"timeframe\":\"" + TimeframeToString(PERIOD_CURRENT) + "\",";
      json += "\"time\":\"" + IntegerToString(rates[i].time) + "\",";
      json += "\"open\":\"" + DoubleToString(rates[i].open, _Digits) + "\",";
      json += "\"high\":\"" + DoubleToString(rates[i].high, _Digits) + "\",";
      json += "\"low\":\"" + DoubleToString(rates[i].low, _Digits) + "\",";
      json += "\"close\":\"" + DoubleToString(rates[i].close, _Digits) + "\",";
      json += "\"tick_volume\":\"" + IntegerToString(rates[i].tick_volume) + "\",";
      json += "\"real_volume\":\"" + IntegerToString(rates[i].real_volume) + "\",";
      json += "\"spread\":\"" + IntegerToString(rates[i].spread) + "\",";
      json += "\"index\":\"" + IntegerToString(copied - 1 - i) + "\"";
      json += "}\n";
      
      SendString(json);
   }
   
   // Send history complete signal
   string complete = "{";
   complete += "\"type\":\"history_complete\",";
   complete += "\"symbol\":\"" + symbol + "\",";
   complete += "\"bars\":\"" + IntegerToString(copied) + "\"";
   complete += "}\n";
   
   SendString(complete);
   Print("History sent for ", symbol);
}

//+------------------------------------------------------------------+
//| Send account information                                           |
//+------------------------------------------------------------------+
void SendAccountInfo()
{
   string json = "{";
   json += "\"type\":\"account\",";
   json += "\"login\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\",";
   json += "\"balance\":\"" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + "\",";
   json += "\"equity\":\"" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + "\",";
   json += "\"margin\":\"" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2) + "\",";
   json += "\"free_margin\":\"" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) + "\",";
   json += "\"profit\":\"" + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2) + "\",";
   json += "\"currency\":\"" + AccountInfoString(ACCOUNT_CURRENCY) + "\",";
   json += "\"leverage\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LEVERAGE)) + "\",";
   json += "\"server\":\"" + EscapeJson(AccountInfoString(ACCOUNT_SERVER)) + "\",";
   json += "\"company\":\"" + EscapeJson(AccountInfoString(ACCOUNT_COMPANY)) + "\",";
   json += "\"name\":\"" + EscapeJson(AccountInfoString(ACCOUNT_NAME)) + "\",";
   
   // Positions
   int totalPositions = PositionsTotal();
   json += "\"positions_count\":\"" + IntegerToString(totalPositions) + "\",";
   json += "\"positions\":[";
   
   for(int i = 0; i < totalPositions; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      
      if(i > 0) json += ",";
      
      string posType = "BUY";
      if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_SELL) posType = "SELL";
      
      json += "{";
      json += "\"ticket\":\"" + IntegerToString(ticket) + "\",";
      json += "\"symbol\":\"" + PositionGetString(POSITION_SYMBOL) + "\",";
      json += "\"type\":\"" + posType + "\",";
      json += "\"volume\":\"" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) + "\",";
      json += "\"open_price\":\"" + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), _Digits) + "\",";
      json += "\"current_price\":\"" + DoubleToString(PositionGetDouble(POSITION_PRICE_CURRENT), _Digits) + "\",";
      json += "\"sl\":\"" + DoubleToString(PositionGetDouble(POSITION_SL), _Digits) + "\",";
      json += "\"tp\":\"" + DoubleToString(PositionGetDouble(POSITION_TP), _Digits) + "\",";
      json += "\"profit\":\"" + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2) + "\",";
      json += "\"swap\":\"" + DoubleToString(PositionGetDouble(POSITION_SWAP), 2) + "\",";
      json += "\"open_time\":\"" + IntegerToString(PositionGetInteger(POSITION_TIME)) + "\",";
      json += "\"magic\":\"" + IntegerToString(PositionGetInteger(POSITION_MAGIC)) + "\",";
      json += "\"comment\":\"" + EscapeJson(PositionGetString(POSITION_COMMENT)) + "\"";
      json += "}";
   }
   json += "],";
   
   // Orders
   int totalOrders = OrdersTotal();
   json += "\"orders_count\":\"" + IntegerToString(totalOrders) + "\",";
   json += "\"orders\":[";
   
   for(int i = 0; i < totalOrders; i++)
   {
      ulong ticket = OrderGetTicket(i);
      if(ticket <= 0) continue;
      
      if(i > 0) json += ",";
      
      json += "{";
      json += "\"ticket\":\"" + IntegerToString(ticket) + "\",";
      json += "\"symbol\":\"" + OrderGetString(ORDER_SYMBOL) + "\",";
      json += "\"type\":\"" + OrderTypeToString((ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE)) + "\",";
      json += "\"volume\":\"" + DoubleToString(OrderGetDouble(ORDER_VOLUME_CURRENT), 2) + "\",";
      json += "\"price\":\"" + DoubleToString(OrderGetDouble(ORDER_PRICE_OPEN), _Digits) + "\",";
      json += "\"sl\":\"" + DoubleToString(OrderGetDouble(ORDER_SL), _Digits) + "\",";
      json += "\"tp\":\"" + DoubleToString(OrderGetDouble(ORDER_TP), _Digits) + "\",";
      json += "\"magic\":\"" + IntegerToString(OrderGetInteger(ORDER_MAGIC)) + "\"";
      json += "}";
   }
   json += "]";
   json += "}\n";
   
   SendString(json);
}

//+------------------------------------------------------------------+
//| Process incoming commands from server                              |
//+------------------------------------------------------------------+
void ProcessIncomingCommands()
{
   if(g_socket == INVALID_HANDLE || !g_connected)
      return;
   
   uchar buffer[];  // <-- was char[], change to uchar[]
   int received = SocketRead(g_socket, buffer, 4096, InpSocketTimeout);
   
   if(received <= 0)
   {
      int err = GetLastError();
      if(err != 0 && err != 5040) // 5040 = no data available
      {
         Print("SocketRead error: ", err);
         g_connected = false;
      }
      return;
   }
   
   // Append to buffer
   string chunk = CharArrayToString(buffer, 0, received, CP_UTF8);
   g_recvBuffer += chunk;
   
   // Process complete messages (newline delimited)
   int newlinePos = StringFind(g_recvBuffer, "\n");
   while(newlinePos != -1)
   {
      string line = StringSubstr(g_recvBuffer, 0, newlinePos);
      StringReplace(line, "\r", ""); // Remove CR
      
      if(StringLen(line) > 1)
      {
         if(InpDebugMode)
            Print("RECV: ", line);
         
         ProcessCommand(line);
      }
      
      g_recvBuffer = StringSubstr(g_recvBuffer, newlinePos + 1);
      newlinePos = StringFind(g_recvBuffer, "\n");
   }
}

//+------------------------------------------------------------------+
//| Process a single command                                           |
//+------------------------------------------------------------------+
void ProcessCommand(string jsonStr)
{
   string cmdType = JsonGetString(jsonStr, "type");
   
   if(cmdType == "place_order")
   {
      HandlePlaceOrder(jsonStr);
   }
   else if(cmdType == "close_position")
   {
      HandleClosePosition(jsonStr);
   }
   else if(cmdType == "modify_position")
   {
      HandleModifyPosition(jsonStr);
   }
   else if(cmdType == "cancel_order")
   {
      HandleCancelOrder(jsonStr);
   }
   else if(cmdType == "get_history")
   {
      HandleGetHistory(jsonStr);
   }
   else if(cmdType == "ping")
   {
      HandlePing(jsonStr);
   }
   else
   {
      Print("Unknown command type: ", cmdType);
      
      string resp = "{";
      resp += "\"type\":\"error\",";
      resp += "\"original_type\":\"" + cmdType + "\",";
      resp += "\"error\":\"Unknown command\"";
      resp += "}\n";
      
      SendString(resp);
   }
}

//+------------------------------------------------------------------+
//| Handle place order command                                         |
//+------------------------------------------------------------------+
void HandlePlaceOrder(string jsonStr)
{
   string symbol = JsonGetString(jsonStr, "symbol");
   string typeStr = JsonGetString(jsonStr, "order_type");
   double volume = StringToDouble(JsonGetString(jsonStr, "volume"));
   double price = StringToDouble(JsonGetString(jsonStr, "price"));
   double sl = StringToDouble(JsonGetString(jsonStr, "sl"));
   double tp = StringToDouble(JsonGetString(jsonStr, "tp"));
   string comment = JsonGetString(jsonStr, "comment");
   if(StringLen(comment) == 0) comment = "MAT.ai";
   
   ENUM_ORDER_TYPE orderType;
   if(typeStr == "BUY") orderType = ORDER_TYPE_BUY;
   else if(typeStr == "SELL") orderType = ORDER_TYPE_SELL;
   else if(typeStr == "BUY_LIMIT") orderType = ORDER_TYPE_BUY_LIMIT;
   else if(typeStr == "SELL_LIMIT") orderType = ORDER_TYPE_SELL_LIMIT;
   else if(typeStr == "BUY_STOP") orderType = ORDER_TYPE_BUY_STOP;
   else if(typeStr == "SELL_STOP") orderType = ORDER_TYPE_SELL_STOP;
   else
   {
      SendError("place_order", "Invalid order type: " + typeStr);
      return;
   }
   
   MqlTradeRequest request = {};
   MqlTradeResult result = {};
   
   request.action = TRADE_ACTION_DEAL;
   if(typeStr == "BUY_LIMIT" || typeStr == "SELL_LIMIT" || 
      typeStr == "BUY_STOP" || typeStr == "SELL_STOP")
   {
      request.action = TRADE_ACTION_PENDING;
      request.price = price;
   }
   
   request.symbol = symbol;
   request.volume = volume;
   request.type = orderType;
   request.sl = sl;
   request.tp = tp;
   request.deviation = 10;
   request.magic = MATAI_MAGIC;
   request.comment = comment;
   
   if(!OrderSend(request, result))
   {
      SendError("place_order", "OrderSend failed: " + IntegerToString(GetLastError()));
      return;
   }
   
   string resp = "{";
   resp += "\"type\":\"order_result\",";
   resp += "\"request_type\":\"place_order\",";
   resp += "\"success\":true,";
   resp += "\"ticket\":\"" + IntegerToString(result.order) + "\",";
   resp += "\"volume\":\"" + DoubleToString(result.volume, 2) + "\",";
   resp += "\"price\":\"" + DoubleToString(result.price, _Digits) + "\",";
   resp += "\"bid\":\"" + DoubleToString(result.bid, _Digits) + "\",";
   resp += "\"ask\":\"" + DoubleToString(result.ask, _Digits) + "\",";
   resp += "\"comment\":\"" + EscapeJson(result.comment) + "\"";
   resp += "}\n";
   
   SendString(resp);
   Print("Order placed: #", result.order, " ", symbol, " ", typeStr, " ", volume);
}

//+------------------------------------------------------------------+
//| Handle close position command                                      |
//+------------------------------------------------------------------+
void HandleClosePosition(string jsonStr)
{
   ulong ticket = (ulong)StringToInteger(JsonGetString(jsonStr, "ticket"));
   
   if(!PositionSelectByTicket(ticket))
   {
      SendError("close_position", "Position not found: " + IntegerToString(ticket));
      return;
   }
   
   string symbol = PositionGetString(POSITION_SYMBOL);
   ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
   double volume = PositionGetDouble(POSITION_VOLUME);
   
   MqlTradeRequest request = {};
   MqlTradeResult result = {};
   
   request.action = TRADE_ACTION_DEAL;
   request.position = ticket;
   request.symbol = symbol;
   request.volume = volume;
   request.deviation = 10;
   request.magic = MATAI_MAGIC;
   request.comment = "MAT.ai Close";
   
   if(posType == POSITION_TYPE_BUY)
      request.type = ORDER_TYPE_SELL;
   else
      request.type = ORDER_TYPE_BUY;
   
   if(!OrderSend(request, result))
   {
      SendError("close_position", "OrderSend failed: " + IntegerToString(GetLastError()));
      return;
   }
   
   string resp = "{";
   resp += "\"type\":\"order_result\",";
   resp += "\"request_type\":\"close_position\",";
   resp += "\"success\":true,";
   resp += "\"ticket\":\"" + IntegerToString(result.order) + "\",";
   resp += "\"volume\":\"" + DoubleToString(result.volume, 2) + "\",";
   resp += "\"price\":\"" + DoubleToString(result.price, _Digits) + "\"";
   resp += "}\n";
   
   SendString(resp);
   Print("Position closed: #", ticket);
}

//+------------------------------------------------------------------+
//| Handle modify position command                                     |
//+------------------------------------------------------------------+
void HandleModifyPosition(string jsonStr)
{
   ulong ticket = (ulong)StringToInteger(JsonGetString(jsonStr, "ticket"));
   double sl = StringToDouble(JsonGetString(jsonStr, "sl"));
   double tp = StringToDouble(JsonGetString(jsonStr, "tp"));
   
   if(!PositionSelectByTicket(ticket))
   {
      SendError("modify_position", "Position not found: " + IntegerToString(ticket));
      return;
   }
   
   string symbol = PositionGetString(POSITION_SYMBOL);
   
   MqlTradeRequest request = {};
   MqlTradeResult result = {};
   
   request.action = TRADE_ACTION_SLTP;
   request.position = ticket;
   request.symbol = symbol;
   request.sl = sl;
   request.tp = tp;
   
   if(!OrderSend(request, result))
   {
      SendError("modify_position", "OrderSend failed: " + IntegerToString(GetLastError()));
      return;
   }
   
   string resp = "{";
   resp += "\"type\":\"order_result\",";
   resp += "\"request_type\":\"modify_position\",";
   resp += "\"success\":true,";
   resp += "\"ticket\":\"" + IntegerToString(ticket) + "\",";
   resp += "\"sl\":\"" + DoubleToString(sl, _Digits) + "\",";
   resp += "\"tp\":\"" + DoubleToString(tp, _Digits) + "\"";
   resp += "}\n";
   
   SendString(resp);
   Print("Position modified: #", ticket, " SL:", sl, " TP:", tp);
}

//+------------------------------------------------------------------+
//| Handle cancel order command                                        |
//+------------------------------------------------------------------+
void HandleCancelOrder(string jsonStr)
{
   ulong ticket = (ulong)StringToInteger(JsonGetString(jsonStr, "ticket"));
   
   if(!OrderSelect(ticket))
   {
      SendError("cancel_order", "Order not found: " + IntegerToString(ticket));
      return;
   }
   
   string symbol = OrderGetString(ORDER_SYMBOL);
   
   MqlTradeRequest request = {};
   MqlTradeResult result = {};
   
   request.action = TRADE_ACTION_REMOVE;
   request.order = ticket;
   request.symbol = symbol;
   
   if(!OrderSend(request, result))
   {
      SendError("cancel_order", "OrderSend failed: " + IntegerToString(GetLastError()));
      return;
   }
   
   string resp = "{";
   resp += "\"type\":\"order_result\",";
   resp += "\"request_type\":\"cancel_order\",";
   resp += "\"success\":true,";
   resp += "\"ticket\":\"" + IntegerToString(ticket) + "\"";
   resp += "}\n";
   
   SendString(resp);
   Print("Order cancelled: #", ticket);
}

//+------------------------------------------------------------------+
//| Handle get history command                                         |
//+------------------------------------------------------------------+
void HandleGetHistory(string jsonStr)
{
   string symbol = JsonGetString(jsonStr, "symbol");
   string tfStr = JsonGetString(jsonStr, "timeframe");
   int count = (int)StringToInteger(JsonGetString(jsonStr, "count"));
   if(count <= 0) count = 100;
   
   ENUM_TIMEFRAMES tf = StringToTimeframe(tfStr);
   
   SendHistoryBars(symbol, tf, count);
}

//+------------------------------------------------------------------+
//| Send historical bars on request                                    |
//+------------------------------------------------------------------+
void SendHistoryBars(string symbol, ENUM_TIMEFRAMES tf, int count)
{
   MqlRates rates[];
   int copied = CopyRates(symbol, tf, 0, count, rates);
   if(copied < 1)
   {
      SendError("get_history", "Failed to copy rates for " + symbol);
      return;
   }
   
   for(int i = copied - 1; i >= 0; i--)
   {
      string json = "{";
      json += "\"type\":\"history_response\",";
      json += "\"symbol\":\"" + symbol + "\",";
      json += "\"timeframe\":\"" + TimeframeToString(tf) + "\",";
      json += "\"time\":\"" + IntegerToString(rates[i].time) + "\",";
      json += "\"open\":\"" + DoubleToString(rates[i].open, _Digits) + "\",";
      json += "\"high\":\"" + DoubleToString(rates[i].high, _Digits) + "\",";
      json += "\"low\":\"" + DoubleToString(rates[i].low, _Digits) + "\",";
      json += "\"close\":\"" + DoubleToString(rates[i].close, _Digits) + "\",";
      json += "\"tick_volume\":\"" + IntegerToString(rates[i].tick_volume) + "\",";
      json += "\"index\":\"" + IntegerToString(copied - 1 - i) + "\"";
      json += "}\n";
      
      SendString(json);
   }
   
   string complete = "{";
   complete += "\"type\":\"history_response_complete\",";
   complete += "\"symbol\":\"" + symbol + "\",";
   complete += "\"timeframe\":\"" + TimeframeToString(tf) + "\",";
   complete += "\"count\":\"" + IntegerToString(copied) + "\"";
   complete += "}\n";
   
   SendString(complete);
}

//+------------------------------------------------------------------+
//| Handle ping                                                        |
//+------------------------------------------------------------------+
void HandlePing(string jsonStr)
{
   string echoTs = JsonGetString(jsonStr, "timestamp");
   
   string resp = "{";
   resp += "\"type\":\"pong\",";
   resp += "\"timestamp\":\"" + IntegerToString(TimeLocal()) + "\",";
   resp += "\"echo\":\"" + echoTs + "\"";
   resp += "}\n";
   
   SendString(resp);
}

//+------------------------------------------------------------------+
//| Send error response                                                |
//+------------------------------------------------------------------+
void SendError(string requestType, string errorMsg)
{
   string err = "{";
   err += "\"type\":\"error\",";
   err += "\"request_type\":\"" + requestType + "\",";
   err += "\"error\":\"" + EscapeJson(errorMsg) + "\"";
   err += "}\n";
   
   SendString(err);
   Print("ERROR [", requestType, "]: ", errorMsg);
}

//+------------------------------------------------------------------+
//| Convert symbols array to JSON array string                         |
//+------------------------------------------------------------------+
string SymbolsToJson()
{
   string result = "";
   for(int i = 0; i < g_symbolCount; i++)
   {
      if(i > 0) result += ",";
      result += "\"" + g_symbols[i] + "\"";
   }
   return result;
}

//+------------------------------------------------------------------+
//| Escape JSON special characters                                     |
//+------------------------------------------------------------------+
string EscapeJson(string str)
{
   string result = str;
   StringReplace(result, "\\", "\\\\");
   StringReplace(result, "\"", "\\\"");
   StringReplace(result, "\n", "\\n");
   StringReplace(result, "\r", "\\r");
   StringReplace(result, "\t", "\\t");
   return result;
}

//+------------------------------------------------------------------+
//| Simple JSON string extractor                                       |
//+------------------------------------------------------------------+
string JsonGetString(string json, string key)
{
   string search = "\"" + key + "\":\"";
   int start = StringFind(json, search);
   if(start != -1)
   {
      start += StringLen(search);
      int end = StringFind(json, "\"", start);
      if(end != -1)
      {
         return StringSubstr(json, start, end - start);
      }
   }
   
   // Try number format
   search = "\"" + key + "\":";
   start = StringFind(json, search);
   if(start != -1)
   {
      start += StringLen(search);
      // Skip whitespace
      while(start < StringLen(json) && 
            (StringGetCharacter(json, start) == ' ' || 
             StringGetCharacter(json, start) == '\t'))
      {
         start++;
      }
      
      // Check if it's a string
      if(StringGetCharacter(json, start) == '"')
      {
         start++;
         int end = StringFind(json, "\"", start);
         if(end != -1)
            return StringSubstr(json, start, end - start);
      }
      else
      {
         // Find end of number/bool
         int end = start;
         while(end < StringLen(json) && 
               StringGetCharacter(json, end) != ',' && 
               StringGetCharacter(json, end) != '}' &&
               StringGetCharacter(json, end) != ' ')
         {
            end++;
         }
         return StringSubstr(json, start, end - start);
      }
   }
   
   return "";
}

//+------------------------------------------------------------------+
//| String to timeframe conversion                                     |
//+------------------------------------------------------------------+
ENUM_TIMEFRAMES StringToTimeframe(string tf)
{
   if(tf == "M1") return PERIOD_M1;
   if(tf == "M5") return PERIOD_M5;
   if(tf == "M15") return PERIOD_M15;
   if(tf == "M30") return PERIOD_M30;
   if(tf == "H1") return PERIOD_H1;
   if(tf == "H4") return PERIOD_H4;
   if(tf == "D1") return PERIOD_D1;
   if(tf == "W1") return PERIOD_W1;
   if(tf == "MN1") return PERIOD_MN1;
   return PERIOD_CURRENT;
}

//+------------------------------------------------------------------+
//| Timeframe to string conversion                                     |
//+------------------------------------------------------------------+
string TimeframeToString(ENUM_TIMEFRAMES tf)
{
   switch(tf)
   {
      case PERIOD_M1: return "M1";
      case PERIOD_M5: return "M5";
      case PERIOD_M15: return "M15";
      case PERIOD_M30: return "M30";
      case PERIOD_H1: return "H1";
      case PERIOD_H4: return "H4";
      case PERIOD_D1: return "D1";
      case PERIOD_W1: return "W1";
      case PERIOD_MN1: return "MN1";
      default: return "CURRENT";
   }
}

//+------------------------------------------------------------------+
//| Order type to string                                               |
//+------------------------------------------------------------------+
string OrderTypeToString(ENUM_ORDER_TYPE type)
{
   switch(type)
   {
      case ORDER_TYPE_BUY: return "BUY";
      case ORDER_TYPE_SELL: return "SELL";
      case ORDER_TYPE_BUY_LIMIT: return "BUY_LIMIT";
      case ORDER_TYPE_SELL_LIMIT: return "SELL_LIMIT";
      case ORDER_TYPE_BUY_STOP: return "BUY_STOP";
      case ORDER_TYPE_SELL_STOP: return "SELL_STOP";
      case ORDER_TYPE_BUY_STOP_LIMIT: return "BUY_STOP_LIMIT";
      case ORDER_TYPE_SELL_STOP_LIMIT: return "SELL_STOP_LIMIT";
      case ORDER_TYPE_CLOSE_BY: return "CLOSE_BY";
      default: return "UNKNOWN";
   }
}

//+------------------------------------------------------------------+
//| Trade event handler                                                |
//+------------------------------------------------------------------+
void OnTrade()
{
   // Send updated positions/orders after trade event
   SendAccountInfo();
}

//+------------------------------------------------------------------+
//| Book event handler                                                 |
//+------------------------------------------------------------------+
void OnBookEvent(const string &symbol)
{
   // Market depth data if needed
}
//+------------------------------------------------------------------+