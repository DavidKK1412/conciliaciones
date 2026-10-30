from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from pypdf import PdfReader, PdfWriter
import os, io
W,H=letter
EMP='FUNDACIÓN EJEMPLO'; NIT='900.000.000-1'
def money_es(v): s=f'{v:,.2f}'; return s.replace(',','X').replace('.',',').replace('X','.')
def money_us(v): return f'{v:,.2f}'

def formato(cta, banco, num, tipo, aux, libros, ext, pend):
    c=canvas.Canvas(f'07/07_{cta}.pdf',pagesize=letter)
    c.setStrokeColor(colors.black); c.rect(40,H-120,W-80,80)
    c.setFont('Helvetica-Bold',20); c.setFillColor(colors.HexColor('#1d5c4a')); c.drawString(55,H-85,EMP)
    c.setFillColor(colors.black); c.setFont('Helvetica-Bold',10)
    c.drawRightString(W-55,H-60,f'NIT. {NIT}'); c.drawRightString(W-55,H-74,'CONCILIACIÓN BANCARIA')
    c.setFont('Helvetica',8.5)
    c.drawString(360,H-90,f'N° Cuenta: {num}'); c.drawString(360,H-102,f'Banco: {banco}')
    c.drawRightString(W-55,H-90,f'Tipo: {tipo}'); c.drawRightString(W-55,H-102,f'Auxiliar: {aux}')
    c.setFont('Helvetica-Bold',10); c.drawCentredString(W/2,H-145,'SALDOS A: 31 DE JULIO DE 2026')
    y=H-175; c.setFont('Helvetica',9.5)
    nc=sum(v for _,_,v in pend)
    rows=[('SALDO SEGÚN LIBROS',libros),('(+) Notas crédito no registradas en contabilidad',0),('(-) Notas débito no registradas en contabilidad',0),
          ('(+) Egresos no reflejados en el extracto',nc),('(-) Ingresos no reflejados en el extracto',0),('SALDO EXTRACTO',ext),('DIFERENCIA',round(libros+nc-ext,2))]
    for lab,v in rows:
        bold=lab.isupper() and not lab.startswith('(')
        c.setFont('Helvetica-Bold' if bold else 'Helvetica',9.5); c.drawString(60,y,lab); c.drawRightString(W-60,y,'$ '+money_es(v))
        c.line(55,y-5,W-55,y-5); y-=20
    y-=15; c.setFont('Helvetica-Bold',9.5); c.drawString(60,y,'(+) EGRESOS NO REFLEJADOS EN EL EXTRACTO - DETALLE'); y-=18
    c.setFont('Helvetica-Bold',8.5)
    for x,t in [(60,'Fecha'),(140,'Tipo Doc.'),(220,'Concepto')]: c.drawString(x,y,t)
    c.drawRightString(W-60,y,'Valor'); y-=14; c.setFont('Helvetica',8.5)
    for f,con,v in pend: c.drawString(60,y,f); c.drawString(140,y,'CE'); c.drawString(220,y,con); c.drawRightString(W-60,y,money_es(v)); y-=13
    if not pend: c.drawString(60,y,'Sin partidas pendientes'); y-=13
    y-=40; c.line(60,y,220,y); c.line(W-220,y,W-60,y); c.drawString(60,y-12,'Elaboró'); c.drawString(W-220,y-12,'Revisó')
    c.save()

def auxiliar(cta, aux, ini, movs, nombre=None):
    c=canvas.Canvas(f'07/{nombre or "AUX 07_"+cta}.pdf',pagesize=letter)
    c.setFont('Helvetica-Bold',13); c.drawCentredString(W/2,H-50,EMP); c.drawCentredString(W/2,H-66,f'(Nit: {NIT})')
    c.setFont('Helvetica-BoldOblique',13); c.drawCentredString(W/2,H-84,'Libro Auxiliar (de 1/JUL/2026 a 31/JUL/2026)')
    y=H-115; c.setFillColor(colors.HexColor('#dde5f0')); c.rect(40,y-4,W-80,16,fill=1,stroke=0); c.setFillColor(colors.black)
    c.setFont('Helvetica-Bold',8)
    for x,t in [(45,'FECHA'),(100,'DOCUMENTO'),(180,'NIT/CEDULA'),(250,'DETALLE')]: c.drawString(x,y,t)
    c.drawRightString(440,y,'DEBITOS'); c.drawRightString(500,y,'CREDITOS'); c.drawRightString(W-45,y,'SALDO')
    y-=20; c.setFont('Helvetica-Bold',8.5); c.drawString(45,y,f'{aux}  BANCOS - CTA {cta}'); y-=14
    c.setFont('Helvetica',8); c.drawString(250,y,'Saldo anterior'); c.drawRightString(W-45,y,money_us(ini)); y-=13
    s=ini; td=tc=0
    for f,doc,det,d,cr in movs:
        s=round(s+d-cr,2); td+=d; tc+=cr
        c.drawString(45,y,f); c.drawString(100,y,doc); c.drawString(180,y,'900000000'); c.drawString(250,y,det)
        c.drawRightString(440,y,money_us(d)); c.drawRightString(500,y,money_us(cr)); c.drawRightString(W-45,y,money_us(s)); y-=13
    y-=6; c.line(40,y+8,W-40,y+8); c.setFont('Helvetica-Bold',8)
    c.drawString(250,y,'Totales desde 01/JUL/2026 hasta 31/JUL/2026'); c.drawRightString(440,y,money_us(td)); c.drawRightString(500,y,money_us(tc)); y-=13
    c.drawString(250,y,'Saldo a 31/JUL/2026'); c.drawRightString(W-45,y,money_us(s))
    c.setFont('Helvetica',7); c.drawString(40,40,'Generado por software contable · 01/08/2026'); c.save()
    return s

def extracto(nombre, banco, num, ini, movs, color, pwd=None, pages=1):
    buf=io.BytesIO(); c=canvas.Canvas(buf,pagesize=letter)
    c.setFillColor(colors.HexColor(color)); c.rect(0,H-70,W,70,fill=1,stroke=0)
    c.setFillColor(colors.white); c.setFont('Helvetica-Bold',22); c.drawString(40,H-45,banco.upper())
    c.setFont('Helvetica',9); c.drawRightString(W-40,H-30,'EXTRACTO CUENTA DE AHORROS'); c.drawRightString(W-40,H-44,'Período: 01/07/2026 - 31/07/2026')
    c.setFillColor(colors.black); c.setFont('Helvetica',9)
    c.drawString(40,H-95,EMP); c.drawString(40,H-108,f'NIT {NIT}'); c.drawString(40,H-121,'BOGOTA D.C.')
    c.drawString(330,H-95,f'Número de cuenta: {num}'); c.drawString(330,H-108,'Sucursal: 0457 CENTRO')
    s=ini; tin=sum(m[2] for m in movs if m[2]>0); tout=-sum(m[2] for m in movs if m[2]<0); fin=round(ini+tin-tout,2)
    y=H-155; c.setFont('Helvetica-Bold',10); c.drawString(40,y,'RESUMEN'); y-=16; c.setFont('Helvetica',9)
    for lab,v in [('Saldo anterior',ini),('(+) Total abonos',tin),('(-) Total cargos',tout),('Saldo actual',fin)]:
        c.drawString(40,y,lab); c.drawRightString(300,y,'$ '+money_es(v)); y-=14
    y-=20; c.setFillColor(colors.HexColor('#eeeeee')); c.rect(40,y-4,W-80,16,fill=1,stroke=0); c.setFillColor(colors.black)
    c.setFont('Helvetica-Bold',8.5); c.drawString(45,y,'FECHA'); c.drawString(100,y,'DESCRIPCIÓN'); c.drawRightString(470,y,'VALOR'); c.drawRightString(W-45,y,'SALDO'); y-=16
    c.setFont('Helvetica',8.5)
    for f,d,v in movs:
        s=round(s+v,2); c.drawString(45,y,f); c.drawString(100,y,d); c.drawRightString(470,y,money_es(v)); c.drawRightString(W-45,y,money_es(s)); y-=13
    c.showPage()
    if pages>1:
        c.setFont('Helvetica',9); c.drawString(40,H-60,'Información importante: consulte el reglamento de cuentas de ahorro en www.ejemplo.com'); c.showPage()
    c.save()
    out=f'07/{nombre}.pdf'
    if pwd:
        w=PdfWriter(); w.append(PdfReader(io.BytesIO(buf.getvalue()))); w.encrypt(pwd); w.write(out)
    else: open(out,'wb').write(buf.getvalue())
    return fin

# Cuenta 0123 Bancolombia: todo cuadra (hay un cheque pendiente)
m=[('03/07/2026','CE-1021','Pago proveedor papelería',0,450000),('10/07/2026','RC-310','Donación recibida',3000000,0),('15/07/2026','CE-1030','Pago nómina',0,1749800),('28/07/2026','CE-1044','Cheque 778 Servicios',0,320000)]
lib=auxiliar('0123','11200501',1500000,m)
ext=extracto('EXT 07_0123','Bancolombia','571-416301-23',1500000,[('03/07','PAGO PSE PAPELERIA',-450000),('10/07','ABONO TRANSFERENCIA DONACION',3000000),('15/07','PAGO NOMINA',-1749800),('31/07','ABONO INTERESES',0)],'#2c2a29')
formato('0123','BANCOLOMBIA','571-416301-23','AHORROS','11200501',lib,ext,[('28/07/2026','Cheque 778 Servicios',320000)])
# Cuenta 0352 Davivienda: el extracto no cuadra con el formato (error de digitación en formato)
m=[('05/07/2026','RC-311','Abono a Bancolombia - traslado',0,500000),('20/07/2026','RC-320','Rendimientos',12345.67,0)]
lib=auxiliar('0352','11200502',2800000,m)
ext=extracto('EXT 07_0352','Davivienda','0457-0000-0352',2800000,[('05/07','TRASLADO A BANCOLOMBIA',-500000),('20/07','RENDIMIENTOS',12345.67)],'#c8102e')
formato('0352','DAVIVIENDA','0457-0000-0352','AHORROS','11200502',lib,ext+1000,[])
# Cuenta 1125 Banco de Bogotá: extracto con contraseña (1234), nombre con 5 dígitos
m=[('12/07/2026','CE-1035','Pago arriendo',0,950000)]
lib=auxiliar('1125','11200503',4100000,m)
ext=extracto('EXT 07_01125','Banco de Bogota','0981-01125',4100000,[('12/07','PAGO ARRIENDO',-950000)],'#003b71',pwd='1234',pages=2)
formato('1125','BANCO DE BOGOTA','0981-01125','AHORROS','11200503',lib,ext,[])
# Cuenta 1146 BBVA: falta el extracto
m=[('02/07/2026','RC-301','Consignación',800000,0)]
lib=auxiliar('1146','11200504',200000,m)
formato('1146','BBVA','0013-0000-1146','AHORROS','11200504',lib,lib,[])
# Cuenta 1651 Fiduciaria: todo cuadra
m=[('31/07/2026','NC-55','Rendimientos fiducia',85432.10,0),('18/07/2026','CE-1040','Retiro a cuenta',0,1000000)]
lib=auxiliar('1651','11200601',25000000,m)
ext=extracto('EXT 07_1651','Fiduciaria Ejemplo','FIC-0001651',25000000,[('18/07','RETIRO A CUENTA BANCARIA',-1000000),('31/07','RENDIMIENTOS',85432.10)],'#5b2a86')
formato('1651','FIDUCIARIA EJEMPLO','FIC-0001651','ENCARGO FIDUCIARIO','11200601',lib,ext,[])
# Ruido: archivo que no sigue el formato
c=canvas.Canvas('07/notas varias.pdf'); c.drawString(60,750,'Notas sueltas - este archivo no es de ninguna cuenta'); c.save()
