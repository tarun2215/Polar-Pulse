"""Cross-platform local launcher; starts only on loopback by default."""
from pathlib import Path
import os,sys,socket,threading,webbrowser,argparse,time
from urllib.request import urlopen
ROOT=Path(__file__).resolve().parent
os.chdir(ROOT)

def main():
    parser=argparse.ArgumentParser(description='POLAR PULSE local research demo')
    parser.add_argument('--port',type=int,default=8000)
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    try:import uvicorn,fastapi,numpy,shapely,pyproj
    except ImportError as error:
        print('\nMissing dependency:',error,'\nRun: python -m pip install -r requirements.txt\n')
        sys.exit(1)
    port=args.port
    if not 1 <= port <= 65535:parser.error('Port must be between 1 and 65535.')
    with socket.socket() as s:
        if s.connect_ex(('127.0.0.1',port))==0:
            print(f'Port {port} is occupied. Close the previous app or use python start.py --port 8001.');sys.exit(1)
    url=f'http://127.0.0.1:{port}'
    print('\n  POLAR PULSE | Predict. Protect. Navigate.\n')
    print('  '+url+'\n  Research demo only. Simulated environment. Not for navigation.\n')
    def open_when_ready():
        for _ in range(120):
            try:
                with urlopen(url+'/api/health',timeout=.5) as response:
                    if response.status==200:
                        webbrowser.open(url);return
            except Exception:
                time.sleep(.25)
        print('Browser was not opened automatically. Visit '+url+' after the server is ready.')
    if not args.no_browser:threading.Thread(target=open_when_ready,daemon=True).start()
    uvicorn.run('backend.app.main:app',host='127.0.0.1',port=port,log_level='info')
if __name__=='__main__':main()
