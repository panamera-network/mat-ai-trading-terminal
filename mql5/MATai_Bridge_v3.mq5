//+------------------------------------------------------------------+
//|                                              MATai_Bridge.mq5    |
//|                        MAT.ai Trading Terminal - MT5 Bridge      |
//|                        Native MQL5 Socket (No JSON Class)        |
//+------------------------------------------------------------------+
#property copyright "MAT.ai"
#property link      "https://mat.ai"
#property version   "3.0"
#property strict

//--- Input Parameters
input string   InpServerHost = "127.0.0.1";    // TCP bridge host
input int      InpServerPort = 5555;           // TCP bridge port
input int      InpTimerInterval = 100;         // Runtime timer interval (ms)
input int      InpReconnectInterval = 5000;    // Reconnect interval (ms)
input int      InpHeartbeatInterval = 30000;   // Heartbeat interval (ms)
input int      InpTickInterval = 100;          // Tick send interval (ms)
input int      InpSocketConnectTimeout = 3000; // Socket connect timeout (ms)
input int      InpSocketReadTimeout = 5;       // Short non-blocking-style read timeout (ms)
input int      InpSocketSendTimeout = 1000;    // Socket send timeout (ms)
input string   InpSymbols = "XAUUSD";          // Canonical terminal symbols
input string   InpSymbolAliases = "XAUUSD=XAUUSD_i"; // Canonical=broker mappings
input int      InpHistoryBars = 500;           // Initial history bars
input bool     InpSendInitialHistory = false;  // Avoid unnecessary startup history flood
input bool     InpDebugMode = false;            // Debug mode

//--- Socket Handle
int g_socket = INVALID_HANDLE;
bool g_connected = false;
uint g_lastReconnect = 0;
uint g_lastHeartbeat = 0;
uint g_lastTickSend = 0;

//--- Symbol tracking
string g_symbols[];          // canonical/request symbols
string g_resolvedSymbols[];  // exact broker symbols
int g_symbolCount = 0;

//--- Rate limiters
datetime g_lastBarTime[];
bool g_newBar[];
string g_lastTickPayload[];
string g_lastBarPayload[];

//--- Buffer for incoming commands
string g_recvBuffer = "";

//--- Magic number for orders
#define MATAI_MAGIC 20240724

//+------------------------------------------------------------------+
//| Expert initialization function                                     |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("=== MAT.ai Bridge v3.0 Starting ===");
   Print("TCP Server: ", InpServerHost, ":", InpServerPort);

   ParseSymbols();

   ArrayResize(g_lastBarTime, g_symbolCount);
   ArrayResize(g_newBar, g_symbolCount);
   ArrayResize(g_lastTickPayload, g_symbolCount);
   ArrayResize(g_lastBarPayload, g_symbolCount);

   for(int i = 0; i < g_symbolCount; i++)
   {
      g_lastBarTime[i] = 0;
      g_newBar[i] = false;
      g_lastTickPayload[i] = "";
      g_lastBarPayload[i] = "";

      if(StringLen(g_resolvedSymbols[i]) == 0)
      {
         Print("Unresolved symbol: ", g_symbols[i]);
         continue;
      }

      if(!SymbolSelect(g_resolvedSymbols[i], true))
         Print("Failed to select broker symbol: ", g_resolvedSymbols[i]);
      else
         Print("Symbol mapped: ", g_symbols[i], " -> ", g_resolvedSymbols[i]);
   }

   if(!EventSetMillisecondTimer(MathMax(50, InpTimerInterval)))
   {
      Print("EventSetMillisecondTimer failed: ", GetLastError());
      return INIT_FAILED;
   }

   // Timer owns reconnects and command processing. It does not depend on market ticks.
   ConnectToServer();
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                  |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("=== MAT.ai Bridge Shutting Down ===");
   DisconnectFromServer();
}

//+------------------------------------------------------------------+
//| Timer-driven runtime                                               |
//+------------------------------------------------------------------+
void OnTimer()
{
   uint nowMs = GetTickCount();

   if(!g_connected)
   {
      if(nowMs - g_lastReconnect >= (uint)MathMax(1000, InpReconnectInterval))
      {
         g_lastReconnect = nowMs;
         ConnectToServer();
      }
      return;
   }

   if(g_socket == INVALID_HANDLE || !SocketIsConnected(g_socket))
   {
      MarkDisconnected("Socket connection lost");
      return;
   }

   ProcessIncomingCommands();

   if(nowMs - g_lastHeartbeat >= (uint)MathMax(1000, InpHeartbeatInterval))
   {
      SendHeartbeat();
      g_lastHeartbeat = nowMs;
   }

   if(nowMs - g_lastTickSend >= (uint)MathMax(50, InpTickInterval))
   {
      SendTickData();
      CheckNewBars();
      g_lastTickSend = nowMs;
   }

   static uint lastAccountSend = 0;
   if(nowMs - lastAccountSend >= 5000)
   {
      SendAccountInfo();
      lastAccountSend = nowMs;
   }
}

// OnTick intentionally remains empty. Runtime must continue when the market is quiet.
void OnTick()
{
}

//+------------------------------------------------------------------+
//| Parse comma-separated symbols                                      |
//+------------------------------------------------------------------+
void ParseSymbols()
{
   string result[];
   ushort separator = StringGetCharacter(",", 0);
   int count = StringSplit(InpSymbols, separator, result);

   if(count <= 0)
   {
      g_symbolCount = 0;
      return;
   }

   g_symbolCount = count;
   ArrayResize(g_symbols, count);
   ArrayResize(g_resolvedSymbols, count);

   for(int i = 0; i < count; i++)
   {
      string canonical = result[i];
      StringTrimLeft(canonical);
      StringTrimRight(canonical);

      g_symbols[i] = canonical;
      g_resolvedSymbols[i] = ResolveBrokerSymbol(canonical);
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

   ResetLastError();
   Print("Connecting to ", InpServerHost, ":", InpServerPort, "...");

   g_socket = SocketCreate();
   if(g_socket == INVALID_HANDLE)
   {
      Print("SocketCreate failed: ", GetLastError());
      return false;
   }

   SocketTimeouts(
      g_socket,
      MathMax(1, InpSocketReadTimeout),
      MathMax(100, InpSocketSendTimeout)
   );

   if(!SocketConnect(
      g_socket,
      InpServerHost,
      InpServerPort,
      MathMax(500, InpSocketConnectTimeout)
   ))
   {
      int err = GetLastError();
      Print("SocketConnect failed: ", err,
            ". Confirm TCP port and MT5 socket permissions.");
      SocketClose(g_socket);
      g_socket = INVALID_HANDLE;
      g_connected = false;
      return false;
   }

   g_connected = true;
   g_recvBuffer = "";
   g_lastHeartbeat = GetTickCount();
   g_lastTickSend = GetTickCount();

   Print("Connected to MAT bridge");
   SendHandshake();

   if(InpSendInitialHistory)
   {
      for(int i = 0; i < g_symbolCount; i++)
      {
         if(StringLen(g_resolvedSymbols[i]) > 0)
            SendHistory(g_symbols[i]);
      }
   }

   return true;
}

void MarkDisconnected(string reason)
{
   if(StringLen(reason) > 0)
      Print(reason);

   if(g_socket != INVALID_HANDLE)
   {
      SocketClose(g_socket);
      g_socket = INVALID_HANDLE;
   }

   g_connected = false;
   g_recvBuffer = "";
}

//+------------------------------------------------------------------+
//| Disconnect from server                                             |
//+------------------------------------------------------------------+
void DisconnectFromServer()
{
   if(g_socket != INVALID_HANDLE && g_connected)
      SendString("{\"type\":\"disconnect\",\"reason\":\"shutdown\"}\n");

   MarkDisconnected("Disconnected from server");
}

//+------------------------------------------------------------------+
//| Send string over socket                                            |
//+------------------------------------------------------------------+
bool SendString(string msg)
{
   if(g_socket == INVALID_HANDLE || !g_connected)
      return false;

   ResetLastError();
   if(!SocketIsWritable(g_socket))
   {
      int writableErr = GetLastError();
      Print("Socket is not writable: ", writableErr);
      MarkDisconnected("Socket send failed");
      return false;
   }
   
   uchar data[];
   int len = StringLen(msg);
   ArrayResize(data, len);
   for(int i = 0; i < len; i++)
   {
      data[i] = (uchar)StringGetCharacter(msg, i);
   }

   int totalSent = 0;
   while(totalSent < len)
   {
      int remaining = len - totalSent;
      uchar chunk[];
      ArrayResize(chunk, remaining);
      for(int i = 0; i < remaining; i++)
         chunk[i] = data[totalSent + i];

      ResetLastError();
      int sent = SocketSend(g_socket, chunk, remaining);
      if(sent <= 0)
      {
         int err = GetLastError();
         Print("SocketSend failed: ", err);
         MarkDisconnected("Socket send failed");
         return false;
      }

      totalSent += sent;
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
   json += "\"version\":\"3.0\",";
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
      if(!SymbolInfoTick(g_resolvedSymbols[i], tick))
         continue;
      
      string json = "{";
      json += "\"type\":\"tick\",";
      json += "\"symbol\":\"" + g_symbols[i] + "\",";
      json += "\"resolved_symbol\":\"" + g_resolvedSymbols[i] + "\",";
      int digits = SymbolDigits(g_resolvedSymbols[i]);
      json += "\"bid\":\"" + DoubleToString(tick.bid, digits) + "\",";
      json += "\"ask\":\"" + DoubleToString(tick.ask, digits) + "\",";
      json += "\"last\":\"" + DoubleToString(tick.last, digits) + "\",";
      json += "\"volume\":\"" + IntegerToString(tick.volume) + "\",";
      json += "\"time\":\"" + IntegerToString(tick.time) + "\",";
      json += "\"time_msc\":\"" + IntegerToString(tick.time_msc) + "\",";
      json += "\"flags\":\"" + IntegerToString(tick.flags) + "\"";
      json += "}\n";

      string payloadKey = DoubleToString(tick.bid, digits) + "|" +
                          DoubleToString(tick.ask, digits) + "|" +
                          IntegerToString(tick.time_msc);
      if(payloadKey == g_lastTickPayload[i])
         continue;

      g_lastTickPayload[i] = payloadKey;
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
      datetime currentBarTime = iTime(g_resolvedSymbols[i], PERIOD_CURRENT, 0);
      
      if(currentBarTime != g_lastBarTime[i])
      {
         if(g_lastBarTime[i] != 0) // Skip first run
         {
            SendBarData(i, 1); // Send completed bar
         }
         g_lastBarTime[i] = currentBarTime;
         g_newBar[i] = true;
      }
      else if(g_newBar[i])
      {
         // Send forming bar updates
         SendBarData(i, 0);
      }
   }
}

//+------------------------------------------------------------------+
//| Send bar (OHLCV) data                                              |
//+------------------------------------------------------------------+
void SendBarData(int symbolIndex, int index)
{
   if(symbolIndex < 0 || symbolIndex >= g_symbolCount)
      return;

   string requestedSymbol = g_symbols[symbolIndex];
   string brokerSymbol = ResolveBrokerSymbol(requestedSymbol);
   if(StringLen(brokerSymbol) == 0)
      return;

   MqlRates rates[];
   int copied = CopyRates(brokerSymbol, PERIOD_CURRENT, index, 1, rates);
   if(copied < 1)
      return;

   int digits = SymbolDigits(brokerSymbol);

   string json = "{";
   json += "\"type\":\"bar\",";
   json += "\"symbol\":\"" + requestedSymbol + "\",";
   json += "\"resolved_symbol\":\"" + brokerSymbol + "\",";
   json += "\"timeframe\":\"" + TimeframeToString(CurrentChartTimeframe()) + "\",";
   json += "\"time\":\"" + IntegerToString(rates[0].time) + "\",";
   json += "\"open\":\"" + DoubleToString(rates[0].open, digits) + "\",";
   json += "\"high\":\"" + DoubleToString(rates[0].high, digits) + "\",";
   json += "\"low\":\"" + DoubleToString(rates[0].low, digits) + "\",";
   json += "\"close\":\"" + DoubleToString(rates[0].close, digits) + "\",";
   json += "\"tick_volume\":\"" + IntegerToString(rates[0].tick_volume) + "\",";
   json += "\"real_volume\":\"" + IntegerToString(rates[0].real_volume) + "\",";
   json += "\"spread\":\"" + IntegerToString(rates[0].spread) + "\",";
   json += "\"isForming\":" + ((index == 0) ? "true" : "false");
   json += "}\n";

   string payloadKey = IntegerToString(rates[0].time) + "|" +
                       DoubleToString(rates[0].open, digits) + "|" +
                       DoubleToString(rates[0].high, digits) + "|" +
                       DoubleToString(rates[0].low, digits) + "|" +
                       DoubleToString(rates[0].close, digits) + "|" +
                       IntegerToString(rates[0].tick_volume) + "|" +
                       IntegerToString(index);
   if(payloadKey == g_lastBarPayload[symbolIndex])
      return;

   g_lastBarPayload[symbolIndex] = payloadKey;
   SendString(json);
}

//+------------------------------------------------------------------+
//| Send historical data                                               |
//+------------------------------------------------------------------+
void SendHistory(string requestedSymbol)
{
   SendHistoryBars(
      requestedSymbol,
      PERIOD_CURRENT,
      InpHistoryBars,
      ""
   );
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
   
   ResetLastError();
   uint readable = SocketIsReadable(g_socket);
   if(readable <= 1)
      return;

   uchar buffer[];
   int received = SocketRead(g_socket, buffer, MathMin(readable, 4096), MathMax(1, InpSocketReadTimeout));
   
   if(received <= 0)
   {
      int err = GetLastError();
      if(err != 0 && err != 5040)
      {
         Print("SocketRead error: ", err);
         MarkDisconnected("Socket read failed");
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
   string requestedSymbol = JsonGetString(jsonStr, "symbol");
   string symbol = ResolveBrokerSymbol(requestedSymbol);
   if(StringLen(symbol) == 0)
   {
      SendError("place_order", "Broker symbol could not be resolved: " + requestedSymbol);
      return;
   }
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
   resp += "\"symbol\":\"" + EscapeJson(requestedSymbol) + "\",";
   resp += "\"resolved_symbol\":\"" + EscapeJson(symbol) + "\",";
   resp += "\"volume\":\"" + DoubleToString(result.volume, 2) + "\",";
   int orderDigits = SymbolDigits(symbol);
   resp += "\"price\":\"" + DoubleToString(result.price, orderDigits) + "\",";
   resp += "\"bid\":\"" + DoubleToString(result.bid, orderDigits) + "\",";
   resp += "\"ask\":\"" + DoubleToString(result.ask, orderDigits) + "\",";
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
   string requestedSymbol = JsonGetString(jsonStr, "symbol");
   string timeframeText = JsonGetString(jsonStr, "timeframe");
   string requestId = JsonGetString(jsonStr, "request_id");
   int count = (int)StringToInteger(JsonGetString(jsonStr, "count"));

   if(count <= 0)
      count = 10;
   count = MathMin(count, 1000);

   ENUM_TIMEFRAMES timeframe;
   if(!TryStringToTimeframe(timeframeText, timeframe))
   {
      SendHistoryError(
         requestedSymbol,
         timeframeText,
         requestId,
         "Unsupported timeframe"
      );
      return;
   }

   SendHistoryBars(requestedSymbol, timeframe, count, requestId);
}

//+------------------------------------------------------------------+
//| Send historical bars on request                                  |
//+------------------------------------------------------------------+
void SendHistoryBars(
   string requestedSymbol,
   ENUM_TIMEFRAMES timeframe,
   int count,
   string requestId
)
{
   string brokerSymbol = ResolveBrokerSymbol(requestedSymbol);
   if(StringLen(brokerSymbol) == 0)
   {
      SendHistoryError(
         requestedSymbol,
         TimeframeToString(timeframe),
         requestId,
         "Broker symbol could not be resolved"
      );
      return;
   }

   if(!SymbolSelect(brokerSymbol, true))
   {
      SendHistoryError(
         requestedSymbol,
         TimeframeToString(timeframe),
         requestId,
         "SymbolSelect failed for " + brokerSymbol
      );
      return;
   }

   MqlRates rates[];
   ArraySetAsSeries(rates, true);

   ResetLastError();
   int copied = CopyRates(brokerSymbol, timeframe, 0, count, rates);
   if(copied < 1)
   {
      SendHistoryError(
         requestedSymbol,
         TimeframeToString(timeframe),
         requestId,
         "CopyRates failed: " + IntegerToString(GetLastError())
      );
      return;
   }

   int digits = SymbolDigits(brokerSymbol);

   // CopyRates with a series array is newest-first; send oldest-first.
   for(int i = copied - 1; i >= 0; i--)
   {
      string json = "{";
      json += "\"type\":\"history_response\",";
      json += "\"request_id\":\"" + EscapeJson(requestId) + "\",";
      json += "\"symbol\":\"" + EscapeJson(requestedSymbol) + "\",";
      json += "\"resolved_symbol\":\"" + EscapeJson(brokerSymbol) + "\",";
      json += "\"timeframe\":\"" + TimeframeToString(timeframe) + "\",";
      json += "\"time\":\"" + IntegerToString(rates[i].time) + "\",";
      json += "\"open\":\"" + DoubleToString(rates[i].open, digits) + "\",";
      json += "\"high\":\"" + DoubleToString(rates[i].high, digits) + "\",";
      json += "\"low\":\"" + DoubleToString(rates[i].low, digits) + "\",";
      json += "\"close\":\"" + DoubleToString(rates[i].close, digits) + "\",";
      json += "\"tick_volume\":\"" + IntegerToString(rates[i].tick_volume) + "\",";
      json += "\"real_volume\":\"" + IntegerToString(rates[i].real_volume) + "\",";
      json += "\"spread\":\"" + IntegerToString(rates[i].spread) + "\",";
      json += "\"isForming\":" + ((i == 0) ? "true" : "false");
      json += "}\n";

      if(!SendString(json))
         return;
   }

   string complete = "{";
   complete += "\"type\":\"history_response_complete\",";
   complete += "\"request_id\":\"" + EscapeJson(requestId) + "\",";
   complete += "\"symbol\":\"" + EscapeJson(requestedSymbol) + "\",";
   complete += "\"resolved_symbol\":\"" + EscapeJson(brokerSymbol) + "\",";
   complete += "\"timeframe\":\"" + TimeframeToString(timeframe) + "\",";
   complete += "\"count\":\"" + IntegerToString(copied) + "\"";
   complete += "}\n";

   SendString(complete);
}

void SendHistoryError(
   string requestedSymbol,
   string timeframe,
   string requestId,
   string message
)
{
   string json = "{";
   json += "\"type\":\"history_response_error\",";
   json += "\"request_id\":\"" + EscapeJson(requestId) + "\",";
   json += "\"symbol\":\"" + EscapeJson(requestedSymbol) + "\",";
   json += "\"timeframe\":\"" + EscapeJson(timeframe) + "\",";
   json += "\"error\":\"" + EscapeJson(message) + "\"";
   json += "}\n";
   SendString(json);
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
//| Broker symbol resolution                                           |
//+------------------------------------------------------------------+
string ResolveAlias(string canonical)
{
   string pairs[];
   ushort comma = StringGetCharacter(",", 0);
   int pairCount = StringSplit(InpSymbolAliases, comma, pairs);

   for(int i = 0; i < pairCount; i++)
   {
      string pair = pairs[i];
      StringTrimLeft(pair);
      StringTrimRight(pair);

      int equalPos = StringFind(pair, "=");
      if(equalPos <= 0)
         continue;

      string left = StringSubstr(pair, 0, equalPos);
      string right = StringSubstr(pair, equalPos + 1);
      StringTrimLeft(left);
      StringTrimRight(left);
      StringTrimLeft(right);
      StringTrimRight(right);

      if(StringCompare(left, canonical, false) == 0)
         return right;
   }

   return "";
}

bool IsStrictSuffixCandidate(string canonical, string candidate)
{
   string base = canonical;
   string name = candidate;
   StringToUpper(base);
   StringToUpper(name);

   if(name == base)
      return true;

   if(StringFind(name, base) != 0)
      return false;

   string suffix = StringSubstr(name, StringLen(base));
   if(StringLen(suffix) == 0)
      return true;

   ushort first = StringGetCharacter(suffix, 0);
   return (
      first == '_' ||
      first == '.' ||
      first == '-' ||
      (first >= '0' && first <= '9')
   );
}

string ResolveBrokerSymbol(string canonical)
{
   if(StringLen(canonical) == 0)
      return "";

   string alias = ResolveAlias(canonical);
   if(StringLen(alias) > 0)
   {
      if(SymbolSelect(alias, true))
         return alias;

      Print("Configured alias is unavailable: ", canonical, " -> ", alias);
   }

   if(SymbolSelect(canonical, true))
      return canonical;

   int total = SymbolsTotal(false);
   string uniqueCandidate = "";

   for(int i = 0; i < total; i++)
   {
      string candidate = SymbolName(i, false);
      if(!IsStrictSuffixCandidate(canonical, candidate))
         continue;

      if(StringLen(uniqueCandidate) > 0 && uniqueCandidate != candidate)
      {
         Print("Ambiguous broker symbol for ", canonical,
               ": ", uniqueCandidate, " and ", candidate);
         return "";
      }

      uniqueCandidate = candidate;
   }

   if(StringLen(uniqueCandidate) > 0 && SymbolSelect(uniqueCandidate, true))
      return uniqueCandidate;

   return "";
}

int SymbolDigits(string symbol)
{
   long digits = 0;
   if(SymbolInfoInteger(symbol, SYMBOL_DIGITS, digits))
      return (int)digits;
   return _Digits;
}

//+------------------------------------------------------------------+
//| Convert symbols array to JSON array string                         |
//+------------------------------------------------------------------+
string SymbolsToJson()
{
   string result = "";
   for(int i = 0; i < g_symbolCount; i++)
   {
      string symbol = g_resolvedSymbols[i];
      if(StringLen(symbol) == 0)
         continue;

      if(StringLen(result) > 0)
         result += ",";
      result += "\"" + EscapeJson(symbol) + "\"";
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
bool TryStringToTimeframe(string tf, ENUM_TIMEFRAMES &result)
{
   string value = tf;
   StringToUpper(value);

   if(value == "M1" || value == "1M") { result = PERIOD_M1; return true; }
   if(value == "M5" || value == "5M") { result = PERIOD_M5; return true; }
   if(value == "M15" || value == "15M") { result = PERIOD_M15; return true; }
   if(value == "M30" || value == "30M") { result = PERIOD_M30; return true; }
   if(value == "H1" || value == "1H") { result = PERIOD_H1; return true; }
   if(value == "H4" || value == "4H") { result = PERIOD_H4; return true; }
   if(value == "D1" || value == "1D") { result = PERIOD_D1; return true; }
   if(value == "W1" || value == "1W") { result = PERIOD_W1; return true; }
   if(value == "MN" || value == "MN1" || value == "1MN")
   {
      result = PERIOD_MN1;
      return true;
   }

   return false;
}

ENUM_TIMEFRAMES StringToTimeframe(string tf)
{
   ENUM_TIMEFRAMES result;
   if(TryStringToTimeframe(tf, result))
      return result;
   return PERIOD_CURRENT;
}

ENUM_TIMEFRAMES CurrentChartTimeframe()
{
   return (ENUM_TIMEFRAMES)_Period;
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
