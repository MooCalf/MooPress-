!macro MooPressOpenWith EXT
  WriteRegStr SHCTX "Software\Classes\${EXT}\OpenWithProgids" "MooPress.Document" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\SupportedTypes" "${EXT}" ""
!macroend

!macro MooPressForget EXT
  DeleteRegValue SHCTX "Software\Classes\${EXT}\OpenWithProgids" "MooPress.Document"
!macroend

!macro customInstall
  WriteRegStr SHCTX "Software\Classes\MooPress.Document" "" "Document"
  WriteRegStr SHCTX "Software\Classes\MooPress.Document\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr SHCTX "Software\Classes\MooPress.Document\shell\open" "FriendlyAppName" "MooPress"
  WriteRegStr SHCTX "Software\Classes\MooPress.Document\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr SHCTX "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}" "FriendlyAppName" "MooPress"
  WriteRegStr SHCTX "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'

  !insertmacro MooPressOpenWith ".docx"
  !insertmacro MooPressOpenWith ".docm"
  !insertmacro MooPressOpenWith ".dotx"
  !insertmacro MooPressOpenWith ".dotm"
  !insertmacro MooPressOpenWith ".doc"
  !insertmacro MooPressOpenWith ".dot"
  !insertmacro MooPressOpenWith ".odt"
  !insertmacro MooPressOpenWith ".rtf"
  !insertmacro MooPressOpenWith ".txt"
  !insertmacro MooPressOpenWith ".md"
  !insertmacro MooPressOpenWith ".markdown"
  !insertmacro MooPressOpenWith ".pdf"
  !insertmacro MooPressOpenWith ".html"
  !insertmacro MooPressOpenWith ".htm"

  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  !insertmacro MooPressForget ".docx"
  !insertmacro MooPressForget ".docm"
  !insertmacro MooPressForget ".dotx"
  !insertmacro MooPressForget ".dotm"
  !insertmacro MooPressForget ".doc"
  !insertmacro MooPressForget ".dot"
  !insertmacro MooPressForget ".odt"
  !insertmacro MooPressForget ".rtf"
  !insertmacro MooPressForget ".txt"
  !insertmacro MooPressForget ".md"
  !insertmacro MooPressForget ".markdown"
  !insertmacro MooPressForget ".pdf"
  !insertmacro MooPressForget ".html"
  !insertmacro MooPressForget ".htm"
  DeleteRegKey SHCTX "Software\Classes\MooPress.Document"
  DeleteRegKey SHCTX "Software\Classes\Applications\${APP_EXECUTABLE_FILENAME}"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
