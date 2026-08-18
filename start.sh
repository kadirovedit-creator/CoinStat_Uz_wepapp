#!/bin/bash

# Start both bot and webhook server
python bot.py &
python webhook_server.py &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
