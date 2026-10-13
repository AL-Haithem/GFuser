!macro customInit
  StrCpy $INSTDIR "C:\Users\haith\Desktop\installs"
!macroend

!macro customPageAfterChangeDir
  !undef MUI_PAGE_CUSTOMFUNCTION_PRE
  !define MUI_PAGE_CUSTOMFUNCTION_PRE customInstFilesPre
!macroend

!ifndef BUILD_UNINSTALLER
  Function customInstFilesPre
    StrCpy $R0 $INSTDIR
    Call instFilesPre
    StrCpy $INSTDIR $R0
  FunctionEnd
!endif