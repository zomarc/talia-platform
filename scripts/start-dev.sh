#!/bin/bash

# Talia Development Startup Script
# This script starts both the frontend and backend development servers

echo "🚀 Starting Talia Development Environment"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Node.js is installed
if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check if npm is installed
if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Node.js version:${NC} $(node --version)"
echo -e "${BLUE}📦 npm version:${NC} $(npm --version)"
echo ""

# Function to start a development server
start_server() {
    local project_name=$1
    local project_path=$2
    local start_command=$3
    local port=$4
    
    echo -e "${YELLOW}🔧 Starting $project_name...${NC}"
    
    if [ -d "$project_path" ]; then
        cd "$project_path" || exit 1
        
        # Check if node_modules exists
        if [ ! -d "node_modules" ]; then
            echo -e "${YELLOW}📦 Installing dependencies for $project_name...${NC}"
            npm install
        fi
        
        if command_exists lsof && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
            local existing_pids
            existing_pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | tr '\n' ' ' | xargs || true)
            local bad_owner=0
            local pid
            for pid in $existing_pids; do
                local cwd cmd
                cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
                cmd=$(ps -p "$pid" -o command= 2>/dev/null || true)
                if [[ -n "$cwd" && "$cwd" == "$project_path"* ]]; then
                    continue
                fi
                echo -e "${RED}❌ Port $port is occupied by a non-${project_name} process${NC}"
                echo -e "${YELLOW}   PID:${NC} ${pid}"
                echo -e "${YELLOW}   CWD:${NC} ${cwd:-unknown}"
                echo -e "${YELLOW}   CMD:${NC} ${cmd:-unknown}"
                bad_owner=1
            done
            if [[ "$bad_owner" -eq 1 ]]; then
                echo -e "${RED}❌ Refusing to start $project_name. Free port $port first.${NC}"
                return 1
            fi
            echo -e "${GREEN}✅ $project_name already running on port $port (not starting another instance)${NC}"
            return 0
        fi

        echo -e "${GREEN}✅ Starting $project_name on port $port${NC}"
        echo -e "${BLUE}📍 Project path: $project_path${NC}"
        echo -e "${BLUE}🚀 Command: $start_command${NC}"
        echo ""
        
        # Start the server in the background
        npm run $start_command &
        local pid=$!
        echo $pid > ".dev-server.pid"
        
        # Give the server a moment to start
        sleep 2
        
        # Check if the process is still running
        if kill -0 $pid 2>/dev/null; then
            echo -e "${GREEN}✅ $project_name started successfully (PID: $pid)${NC}"
        else
            echo -e "${RED}❌ Failed to start $project_name${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Project directory not found: $project_path${NC}"
        return 1
    fi
}

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start GraphQL Server (Backend)
echo -e "${BLUE}🔧 Starting Backend (GraphQL Server)...${NC}"
start_server "Talia GraphQL Server" "$SCRIPT_DIR/../talia-server" "start" "4000"
BACKEND_PID=$?

echo ""

# Start React App (Frontend)
echo -e "${BLUE}🔧 Starting Frontend (React App)...${NC}"
start_server "Talia UI" "$SCRIPT_DIR/../talia-ui" "dev" "5173"
FRONTEND_PID=$?

echo ""

# Wait a moment for servers to fully start
echo -e "${YELLOW}⏳ Waiting for servers to fully start...${NC}"
sleep 5

# Check if both servers are running
echo -e "${BLUE}🔍 Checking server status...${NC}"

# Check GraphQL server
if curl -s http://localhost:4000/graphql > /dev/null 2>&1; then
    echo -e "${GREEN}✅ GraphQL Server is running at http://localhost:4000${NC}"
else
    echo -e "${RED}❌ GraphQL Server is not responding${NC}"
fi

# Check React app
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ React App is running at http://localhost:5173${NC}"
else
    echo -e "${RED}❌ React App is not responding${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Development environment started!${NC}"
echo ""
echo -e "${BLUE}📱 Frontend:${NC} http://localhost:5173"
echo -e "${BLUE}🔧 GraphQL Server:${NC} http://localhost:4000"
echo -e "${BLUE}🎮 GraphQL Playground:${NC} http://localhost:4000"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "   • Use Ctrl+C to stop all servers"
echo "   • Check individual project directories for logs"
echo "   • GraphQL queries are tested at http://localhost:4000"
echo ""
echo -e "${BLUE}🛠️  Development Commands:${NC}"
echo "   • Frontend: cd talia-ui && npm run dev"
echo "   • Backend:  cd talia-server && npm run start"
echo "   • Stop:     pkill -f 'npm run'"
echo ""

# Keep the script running and show logs
echo -e "${YELLOW}📋 Server logs will appear below. Press Ctrl+C to stop all servers.${NC}"
echo "=========================================="

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping all development servers...${NC}"
    
    # Kill only this script's UI/API ports — never pkill vite (that reaps demo preview :4173)
    if command -v lsof >/dev/null 2>&1; then
      local pids
      pids=$(lsof -ti:5173,4000 2>/dev/null | tr '\n' ' ' | xargs || true)
      if [[ -n "$pids" ]]; then
        kill $pids 2>/dev/null || true
        sleep 1
        kill -9 $pids 2>/dev/null || true
      fi
    fi
    
    # Remove PID files
    rm -f "$SCRIPT_DIR/../talia-ui/.dev-server.pid"
    rm -f "$SCRIPT_DIR/../talia-server/.dev-server.pid"
    
    echo -e "${GREEN}✅ All servers stopped.${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait
