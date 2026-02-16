# K.I.T. as Windows Service (NSSM)

Run K.I.T. as a Windows service that auto-starts on boot using NSSM (Non-Sucking Service Manager).

## Prerequisites

1. Download NSSM from https://nssm.cc/download
2. Extract to `C:\nssm-2.24\`
3. Complete K.I.T. onboarding first: `kit onboard`

## Install Service

```cmd
REM Install the service
C:\nssm-2.24\win64\nssm.exe install KitGateway "C:\Program Files\nodejs\node.exe"

REM Set script parameters
C:\nssm-2.24\win64\nssm.exe set KitGateway AppParameters "C:\k.i.t.-bot\dist\src\cli\kit.js start --no-dashboard"

REM Set working directory
C:\nssm-2.24\win64\nssm.exe set KitGateway AppDirectory C:\k.i.t.-bot

REM IMPORTANT: Set environment variables for correct home directory
REM This fixes os.homedir() returning wrong path when running as SYSTEM
C:\nssm-2.24\win64\nssm.exe set KitGateway AppEnvironmentExtra "HOME=C:\Users\YourUser" "USERPROFILE=C:\Users\YourUser" "KIT_HOME=C:\Users\YourUser\.kit"

REM Set display name
C:\nssm-2.24\win64\nssm.exe set KitGateway DisplayName "K.I.T. Gateway"

REM Auto-start on boot
C:\nssm-2.24\win64\nssm.exe set KitGateway Start SERVICE_AUTO_START

REM Set log files
C:\nssm-2.24\win64\nssm.exe set KitGateway AppStdout C:\k.i.t.-bot\kit-service-stdout.log
C:\nssm-2.24\win64\nssm.exe set KitGateway AppStderr C:\k.i.t.-bot\kit-service-stderr.log
```

## Start/Stop Service

```cmd
REM Start
C:\nssm-2.24\win64\nssm.exe start KitGateway

REM Stop
C:\nssm-2.24\win64\nssm.exe stop KitGateway

REM Restart
C:\nssm-2.24\win64\nssm.exe restart KitGateway

REM Check status
C:\nssm-2.24\win64\nssm.exe status KitGateway
```

## Remove Service

```cmd
C:\nssm-2.24\win64\nssm.exe stop KitGateway
C:\nssm-2.24\win64\nssm.exe remove KitGateway confirm
```

## Troubleshooting

### "K.I.T. needs to be configured first" in service logs

The service runs as SYSTEM user, which has a different home directory. Fix by setting the environment variables:

```cmd
C:\nssm-2.24\win64\nssm.exe set KitGateway AppEnvironmentExtra "HOME=C:\Users\YourUser" "USERPROFILE=C:\Users\YourUser" "KIT_HOME=C:\Users\YourUser\.kit"
```

### Check logs

```cmd
type C:\k.i.t.-bot\kit-service-stdout.log
type C:\k.i.t.-bot\kit-service-stderr.log
```

### Service starts but Gateway offline

Check if port 18799 is in use:
```cmd
netstat -ano | findstr 18799
```

Kill conflicting processes:
```cmd
taskkill /F /IM node.exe
```
