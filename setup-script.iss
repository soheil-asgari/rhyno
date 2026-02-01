[Setup]
AppName=Rhyno Finance
AppVersion=1.0
DefaultDirName={userappdata}\RhynoFinance
DefaultGroupName=Rhyno Finance
OutputDir=D:\rhyno-site
OutputBaseFilename=RhynoFinance_Final_Setup
Compression=lzma2/ultra64
SolidCompression=yes
PrivilegesRequired=lowest
AlwaysRestart=yes
; آدرس آیکون در پوشه عمومی پروژه شما
SetupIconFile=D:\rhyno-site\rhyno\public\favicon.ico

[Files]
; کپی تمام فایل‌ها (شامل node_modules و .next) از مسیر دقیق پروژه شما
Source: "D:\rhyno-site\rhyno\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; فایل نصبی نود جی اس
Source: "D:\rhyno-site\rhyno\installers\node-v20.20.0-x64.msi"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{autodesktop}\Rhyno Finance"; Filename: "{app}\start-app.bat"; IconFilename: "{app}\public\favicon.ico"
Name: "{group}\Rhyno Finance"; Filename: "{app}\start-app.bat"; IconFilename: "{app}\public\favicon.ico"

[Run]
Filename: "msiexec.exe"; Parameters: "/i ""{tmp}\node-v20.20.0-x64.msi"" /passive /norestart"; StatusMsg: "Installing Node.js... Please wait."; Check: NotNodeInstalled

[Code]
function NotNodeInstalled: Boolean;
var
  ResultCode: Integer;
begin
  Result := not Exec('cmd.exe', '/c node -v', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;