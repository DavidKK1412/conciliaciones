Attribute VB_Name = "Conciliaciones"
Sub ExportarConciliacionesPDF()
    ' Exporta cada hoja cuyo nombre empiece por "_" (ej. _0123) como MM_0123.pdf
    Dim ws As Worksheet, carpeta As String, mes As String, n As Long, hojaActiva As Worksheet

    mes = InputBox("Mes de la conciliación (2 dígitos):", "Exportar conciliaciones", _
                   Format(DateAdd("m", -1, Date), "mm"))
    If mes = "" Then Exit Sub
    mes = Format(Val(mes), "00")

    With Application.FileDialog(4) ' 4 = elegir carpeta
        .Title = "¿Dónde guardo los PDF?"
        If .Show <> -1 Then Exit Sub
        carpeta = .SelectedItems(1)
    End With
    If Right(carpeta, 1) <> "\" Then carpeta = carpeta & "\"

    Set hojaActiva = ActiveSheet
    Application.ScreenUpdating = False
    For Each ws In ActiveWorkbook.Worksheets
        If Left(ws.Name, 1) = "_" And ws.Visible = -1 Then
            ws.ExportAsFixedFormat Type:=0, _
                Filename:=carpeta & mes & ws.Name & ".pdf", _
                Quality:=0, IncludeDocProperties:=False, _
                IgnorePrintAreas:=False, OpenAfterPublish:=False
            n = n + 1
        End If
    Next ws
    hojaActiva.Activate
    Application.ScreenUpdating = True

    MsgBox n & " formatos guardados en:" & vbCrLf & carpeta, vbInformation
End Sub
