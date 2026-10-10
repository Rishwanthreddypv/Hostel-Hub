from pathlib import Path
from urllib.request import urlopen, Request
from concurrent.futures import ThreadPoolExecutor
assets={
 'hero':'photo-1600210492486-724fe5c67fb0',
 'room-1':'photo-1522708323590-d24dbb6b0267',
 'room-2':'photo-1611892440504-42a792e24d32',
 'room-3':'photo-1555854877-bab0e564b8d5',
 'room-4':'photo-1540518614846-7eded433c457',
 'room-5':'photo-1566665797739-1674de7a421a',
 'room-6':'photo-1560448204-e02f11c3d0e2',
 'room-7':'photo-1505693416388-ac5ce068fe85',
 'lounge':'photo-1600607687939-ce8a6c25118c'
}
root=Path(__file__).resolve().parents[1]/'public'/'images'
root.mkdir(parents=True,exist_ok=True)
def download(item):
 name,photo=item
 url=f'https://images.unsplash.com/{photo}?auto=format&fit=crop&w={1500 if name=="hero" else 900}&q=85'
 with urlopen(Request(url,headers={'User-Agent':'HostelHub-CollegeProject/1.0'}),timeout=30) as response:
  (root/(name+'.jpg')).write_bytes(response.read())
 print(name+' downloaded')
with ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(download,assets.items()))
