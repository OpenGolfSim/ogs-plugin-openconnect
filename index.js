/// <reference path="plugins.d.ts" />

// OpenConnect V1 default port is 921
const PORT = 921;

// Keep track of the launch monitor status to show in the OpenGolfSim UI
const device = { isConnected: false, isReady: false };

const server = network.createServer((socket) => {
  logging.info('Launch monitor connected via OpenConnect V1');
  
  device.isConnected = true;
  device.isReady = true;
  shotData.updateDeviceStatus(device);

  socket.on('data', (data) => {
    try {
      // Parse the incoming JSON payload from the launch monitor
      const payloadStr = data.toString('utf8');
      const obj = JSON.parse(payloadStr);

      if (obj.ShotDataOptions) {
        
        // Update the Launch Monitor Ready state if provided
        if (typeof obj.ShotDataOptions.LaunchMonitorIsReady === 'boolean') {
          device.isReady = obj.ShotDataOptions.LaunchMonitorIsReady;
          shotData.updateDeviceStatus(device);
        }

        // Handle Heartbeats
        if (obj.ShotDataOptions.IsHeartBeat) {
          logging.info('Heartbeat received');
          return;
        }

        // Process Ball/Shot Data
        if (obj.ShotDataOptions.ContainsBallData && obj.BallData) {
          
          // Map the OpenConnect V1 data to OpenGolfSim's shot format
          const openGolfSimShot = {
            ballSpeed: obj.BallData.Speed,
            verticalLaunchAngle: obj.BallData.VLA,
            horizontalLaunchAngle: obj.BallData.HLA,
            spinSpeed: obj.BallData.TotalSpin,
            spinAxis: obj.BallData.SpinAxis
          };

          logging.info(`Sending shot to OpenGolfSim engine...`);
          shotData.sendShot(openGolfSimShot);

          // Reply with a 200 Success Code per OpenConnect V1 protocol specifications
          const response = {
            Code: 200,
            Message: "Shot received successfully"
          };
          socket.write(JSON.stringify(response) + '\n');
        }
      }
    } catch (error) {
      // Due to TCP streaming, chunks could arrive fragmented. 
      // A robust implementation would buffer data until a full JSON object is formed.
      logging.error(`Error processing OpenConnect payload: ${error.message}`);
    }
  });

  socket.on('close', () => {
    logging.info('Launch monitor socket closed');
    device.isConnected = false;
    device.isReady = false;
    shotData.updateDeviceStatus(device);
  });

  socket.on('end', () => {
    logging.info('Launch monitor disconnected');
    device.isConnected = false;
    device.isReady = false;
    shotData.updateDeviceStatus(device);
  });

  socket.on('error', (err) => {
    logging.error(`Socket error: ${err}`);
  });
});

server.on('close', () => {
  logging.info('OpenConnect V1 TCP server closed');
  device.isConnected = false;
  device.isReady = false;
  shotData.updateDeviceStatus(device);
});

system.on('exit', async () => {
  server.close();
  device.isConnected = false;
  device.isReady = false;
  shotData.updateDeviceStatus(device);  
});

logging.info('Starting OpenConnect V1 TCP server...');
server.listen(PORT, () => {
  logging.info(`Listening for OpenConnect V1 clients at 127.0.0.1:${PORT}`);
});