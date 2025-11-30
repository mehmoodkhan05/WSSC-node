#!/bin/bash

echo "Starting WSSC Backend Server..."
echo ""

cd backend

echo "Checking if MongoDB is running..."
if ! mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "MongoDB is not running. Attempting to start..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start mongodb-community
    else
        sudo systemctl start mongodb
    fi
    sleep 3
fi

echo ""
echo "Starting backend server..."
echo ""
npm run dev

