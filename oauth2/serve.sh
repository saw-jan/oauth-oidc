#!/bin/bash

node auth-server/index.js &
node secure-client/index.js &

wait