from urllib.request import urlopen,Request
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]/'public'/'fonts'
root.mkdir(parents=True,exist_ok=True)
for name,family in [('dm-sans','DM+Sans'),('manrope','Manrope')]:
 filename='DMSans%5Bopsz,wght%5D.ttf' if name=='dm-sans' else 'Manrope%5Bwght%5D.ttf'
 font_url='https://raw.githubusercontent.com/google/fonts/main/ofl/'+name.replace('-','')+'/'+filename
 data=urlopen(font_url,timeout=30).read()
 (root/(name+'.ttf')).write_bytes(data)
 print(name,len(data))
 license_url='https://raw.githubusercontent.com/google/fonts/main/ofl/'+name.replace('-','')+'/OFL.txt'
 (root/(name+'-LICENSE.txt')).write_bytes(urlopen(license_url,timeout=30).read())
