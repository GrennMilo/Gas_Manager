import os
import sys
import json
import csv
import datetime
import mimetypes
import socket
import ssl
from flask import Flask, render_template, request, send_file, jsonify, send_from_directory
from flask_cors import CORS
import webbrowser
from threading import Timer
import glob

# Ensure proper MIME types
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('image/png', '.png')
mimetypes.add_type('image/jpeg', '.jpg')
mimetypes.add_type('image/jpeg', '.jpeg')

# Define the base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Define SSL certificate paths
SSL_DIR = os.path.join(BASE_DIR, "ssl")
SSL_CERT = os.path.join(SSL_DIR, "cert.pem")
SSL_KEY = os.path.join(SSL_DIR, "key.pem")

# Create Flask app with static folder configuration
app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
CORS(app)

# Define output directory for CSV files
OUTPUT_DIR = "reports"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Helper functions
def format_date(iso_date):
    """Format ISO date string to DD/MM/YYYY format"""
    try:
        date_obj = datetime.datetime.fromisoformat(iso_date.replace('Z', '+00:00'))
        return date_obj.strftime("%d/%m/%Y")
    except Exception:
        return iso_date

def get_physical_form_label(form):
    """Convert physical form code to readable label"""
    labels = {
        'gas': 'Gas',
        'liquid': 'Liquido',
        'liquidWithDip': 'Liquido con pescante'
    }
    return labels.get(form, form)

def generate_timestamp():
    """Generate a timestamp for filenames"""
    return datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

def get_local_ip():
    """Get the local IP address of the machine"""
    try:
        # Create a socket connection to an external server
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        # Doesn't need to be reachable
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "127.0.0.1"  # Fallback to localhost if can't determine IP

@app.route('/')
def index():
    """Serve the main HTML page"""
    return send_from_directory(BASE_DIR, 'gas.html')

@app.route('/camera-test')
def camera_test():
    """Serve the camera test diagnostic tool"""
    return send_from_directory(BASE_DIR, 'camera_test.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory(BASE_DIR, path)

@app.route('/api/export-stock', methods=['POST'])
def export_stock():
    """Generate CSV file for current stock"""
    data = request.json
    
    # Generate filename with timestamp
    filename = f"stock_bombole_{generate_timestamp()}.csv"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    try:
        with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['Codice Bombola', 'Tipo Gas', 'Pressione (bar)', 
                         'Volume Cilindro (L)', 'Forma Fisica', 'Data Ingresso']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            for cylinder in data:
                writer.writerow({
                    'Codice Bombola': cylinder['code'],
                    'Tipo Gas': cylinder['gasType'],
                    'Pressione (bar)': cylinder['pressure'],
                    'Volume Cilindro (L)': cylinder.get('cylinderVolume', '50'),
                    'Forma Fisica': get_physical_form_label(cylinder['physicalForm']),
                    'Data Ingresso': format_date(cylinder['entryDate'])
                })
                
        return jsonify({
            'success': True,
            'message': f'Stock esportato con successo in {filename}',
            'filepath': filepath
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Errore durante l\'esportazione: {str(e)}'
        }), 500

@app.route('/api/export-history', methods=['POST'])
def export_history():
    """Generate CSV file for operation history"""
    data = request.json
    
    # Generate filename with timestamp
    filename = f"storico_bombole_{generate_timestamp()}.csv"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    try:
        with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['Codice Bombola', 'Tipo Gas', 'Pressione Ingresso (bar)', 
                         'Volume Cilindro (L)', 'Pressione Uscita (bar)', 'Data Ingresso', 'Data Uscita',
                         'Consumo (bar)', 'Percentuale Consumo (%)', 'Consumo (L)']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            for record in data:
                # Calculate consumption metrics
                pressureIn = float(record['pressureIn'])
                pressureOut = float(record['pressureOut'])
                cylinderVolume = float(record.get('cylinderVolume', '50'))
                consumption = pressureIn - pressureOut
                consumption_percentage = (consumption / pressureIn * 100) if pressureIn > 0 else 0
                consumed_liters = (consumption * cylinderVolume)
                
                writer.writerow({
                    'Codice Bombola': record['code'],
                    'Tipo Gas': record['gasType'],
                    'Pressione Ingresso (bar)': pressureIn,
                    'Volume Cilindro (L)': cylinderVolume,
                    'Pressione Uscita (bar)': pressureOut,
                    'Data Ingresso': format_date(record['entryDate']),
                    'Data Uscita': format_date(record['exitDate']),
                    'Consumo (bar)': round(consumption, 2),
                    'Percentuale Consumo (%)': round(consumption_percentage, 2),
                    'Consumo (L)': round(consumed_liters, 2)
                })
                
        return jsonify({
            'success': True,
            'message': f'Storico esportato con successo in {filename}',
            'filepath': filepath
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Errore durante l\'esportazione: {str(e)}'
        }), 500

@app.route('/api/export-all', methods=['POST'])
def export_all():
    """Generate comprehensive report with all data"""
    data = request.json
    stock = data.get('cylinders', [])
    history = data.get('history', [])
    
    # Generate filename with timestamp
    filename = f"report_completo_bombole_{generate_timestamp()}.csv"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    try:
        with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            
            # Write report header
            writer.writerow(['REPORT COMPLETO GESTIONE BOMBOLE'])
            writer.writerow(['Data generazione:', datetime.datetime.now().strftime("%d/%m/%Y %H:%M:%S")])
            writer.writerow([])
            
            # Write stock section
            writer.writerow(['STOCK ATTUALE'])
            writer.writerow(['Codice Bombola', 'Tipo Gas', 'Pressione (bar)', 
                           'Volume Cilindro (L)', 'Forma Fisica', 'Data Ingresso'])
            
            for cylinder in stock:
                writer.writerow([
                    cylinder['code'],
                    cylinder['gasType'],
                    cylinder['pressure'],
                    cylinder.get('cylinderVolume', '50'),
                    get_physical_form_label(cylinder['physicalForm']),
                    format_date(cylinder['entryDate'])
                ])
            
            writer.writerow([])
            writer.writerow(['Totale bombole in stock:', len(stock)])
            
            # Gas type summary
            gas_types = {}
            for cylinder in stock:
                gas = cylinder['gasType']
                if gas in gas_types:
                    gas_types[gas] += 1
                else:
                    gas_types[gas] = 1
            
            writer.writerow([])
            writer.writerow(['RIEPILOGO PER TIPO DI GAS'])
            writer.writerow(['Tipo Gas', 'Quantità'])
            for gas, count in gas_types.items():
                writer.writerow([gas, count])
            
            writer.writerow([])
            
            # Write history section
            writer.writerow(['STORICO OPERAZIONI'])
            writer.writerow(['Codice Bombola', 'Tipo Gas', 'Pressione Ingresso (bar)', 
                           'Volume Cilindro (L)', 'Pressione Uscita (bar)', 'Data Ingresso', 'Data Uscita',
                           'Consumo (bar)', 'Percentuale Consumo (%)', 'Consumo (L)'])
            
            for record in history:
                # Calculate consumption metrics
                pressureIn = float(record['pressureIn'])
                pressureOut = float(record['pressureOut'])
                cylinderVolume = float(record.get('cylinderVolume', '50'))
                consumption = pressureIn - pressureOut
                consumption_percentage = (consumption / pressureIn * 100) if pressureIn > 0 else 0
                consumed_liters = (consumption * cylinderVolume)
                
                writer.writerow([
                    record['code'],
                    record['gasType'],
                    pressureIn,
                    cylinderVolume,
                    pressureOut,
                    format_date(record['entryDate']),
                    format_date(record['exitDate']),
                    round(consumption, 2),
                    round(consumption_percentage, 2),
                    round(consumed_liters, 2)
                ])
            
            writer.writerow([])
            writer.writerow(['Totale operazioni completate:', len(history)])
            
            # Consumption summary by gas type
            gas_consumption = {}  # Bar consumption
            gas_volume_consumption = {}  # Liter consumption
            
            for record in history:
                gas = record['gasType']
                pressureIn = float(record['pressureIn'])
                pressureOut = float(record['pressureOut'])
                cylinderVolume = float(record.get('cylinderVolume', '50'))
                
                # Calculate consumption in bar
                consumption = pressureIn - pressureOut
                
                # Calculate consumption in liters
                # Formula: consumed_liters = (pressure_diff * cylinder_volume)
                consumed_liters = (consumption * cylinderVolume)
                
                if gas in gas_consumption:
                    gas_consumption[gas] += consumption
                    gas_volume_consumption[gas] += consumed_liters
                else:
                    gas_consumption[gas] = consumption
                    gas_volume_consumption[gas] = consumed_liters
            
            writer.writerow([])
            writer.writerow(['RIEPILOGO CONSUMO PER TIPO DI GAS'])
            writer.writerow(['Tipo Gas', 'Consumo Totale (bar)', 'Consumo Totale (L)'])
            
            for gas in gas_consumption:
                writer.writerow([
                    gas, 
                    round(gas_consumption[gas], 2),
                    round(gas_volume_consumption[gas], 2)
                ])
                
            # Add overall total consumption
            total_bar_consumption = sum(gas_consumption.values())
            total_liter_consumption = sum(gas_volume_consumption.values())
            
            writer.writerow([])
            writer.writerow(['CONSUMO TOTALE', 
                           round(total_bar_consumption, 2), 
                           round(total_liter_consumption, 2)])
                
        return jsonify({
            'success': True,
            'message': f'Report completo generato con successo in {filename}',
            'filepath': filepath
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Errore durante la generazione del report: {str(e)}'
        }), 500

@app.route('/api/extract-localstorage', methods=['POST'])
def extract_localstorage():
    """Receive localStorage data from client and save it to a file"""
    data = request.json
    
    # Generate backup filename with timestamp
    filename = f"backup_data_{generate_timestamp()}.json"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
                
        return jsonify({
            'success': True,
            'message': f'Dati salvati con successo in {filename}',
            'filepath': filepath
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Errore durante il salvataggio dei dati: {str(e)}'
        }), 500

@app.route('/download/<path:filename>')
def download_file(filename):
    """Download a file from the reports directory"""
    return send_from_directory(OUTPUT_DIR, filename, as_attachment=True)

def get_latest_backup():
    """Find the most recent backup file in the reports directory"""
    backup_files = glob.glob(os.path.join(OUTPUT_DIR, "backup_data_*.json"))
    if not backup_files:
        return None
    
    # Sort files by modification time (newest first)
    latest_file = max(backup_files, key=os.path.getmtime)
    return latest_file

@app.route('/api/load-data', methods=['GET'])
def load_data():
    """Load data from the most recent backup file"""
    latest_backup = get_latest_backup()
    
    if not latest_backup:
        return jsonify({
            'success': False,
            'message': 'Nessun backup trovato',
            'data': {'cylinders': [], 'history': []}
        })
    
    try:
        with open(latest_backup, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        return jsonify({
            'success': True,
            'message': f'Dati caricati da {os.path.basename(latest_backup)}',
            'data': data
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Errore durante il caricamento dei dati: {str(e)}',
            'data': {'cylinders': [], 'history': []}
        }), 500

@app.route('/api/list-backups', methods=['GET'])
def list_backups():
    """List all available backup files"""
    backup_files = glob.glob(os.path.join(OUTPUT_DIR, "backup_data_*.json"))
    
    if not backup_files:
        return jsonify({
            'success': False,
            'message': 'Nessun backup trovato',
            'backups': []
        })
    
    # Sort files by modification time (newest first)
    backup_files.sort(key=os.path.getmtime, reverse=True)
    
    # Extract file information
    backups = []
    for file_path in backup_files:
        filename = os.path.basename(file_path)
        mod_time = datetime.datetime.fromtimestamp(os.path.getmtime(file_path))
        
        # Try to get cylinder and history counts
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                cylinders_count = len(data.get('cylinders', []))
                history_count = len(data.get('history', []))
        except:
            cylinders_count = 0
            history_count = 0
        
        backups.append({
            'filename': filename,
            'modified': mod_time.strftime("%d/%m/%Y %H:%M:%S"),
            'cylinders_count': cylinders_count,
            'history_count': history_count
        })
    
    return jsonify({
        'success': True,
        'message': f'Trovati {len(backups)} backup',
        'backups': backups
    })

@app.route('/api/load-backup/<path:filename>', methods=['GET'])
def load_specific_backup(filename):
    """Load data from a specific backup file"""
    file_path = os.path.join(OUTPUT_DIR, filename)
    
    if not os.path.exists(file_path):
        return jsonify({
            'success': False,
            'message': f'Backup {filename} non trovato',
            'data': {'cylinders': [], 'history': []}
        }), 404
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        return jsonify({
            'success': True,
            'message': f'Dati caricati da {filename}',
            'data': data
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Errore durante il caricamento del backup: {str(e)}',
            'data': {'cylinders': [], 'history': []}
        }), 500

def open_browser():
    """Open browser after Flask app starts"""
    # Get local IP address
    local_ip = get_local_ip()
    # Open browser to the local IP address using HTTPS
    webbrowser.open_new(f'https://{local_ip}:8078/')

if __name__ == '__main__':
    # Get local IP address
    local_ip = get_local_ip()
    
    # Check if SSL certificates exist
    if not os.path.exists(SSL_CERT) or not os.path.exists(SSL_KEY):
        print("\nERROR: SSL certificates not found. Please run 'python create_cert.py' first.")
        sys.exit(1)
    
    # Open browser automatically
    Timer(1, open_browser).start()
    
    # Print startup message
    print("\n" + "="*80)
    print(" RMIC - Gestione Bombole in Pressione - Server Report".center(80))
    print("="*80)
    print(f" Server avviato: https://{local_ip}:8078/")
    print(f" Accesso locale: https://127.0.0.1:8078/")
    print(f" Directory report: {os.path.abspath(OUTPUT_DIR)}")
    print("="*80)
    print(" Per terminare premere CTRL+C")
    print("="*80 + "\n")
    
    # Create SSL context
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(SSL_CERT, SSL_KEY)
    
    # Start Flask app with network access and SSL
    app.run(
        host='0.0.0.0', 
        port=8078, 
        debug=False,
        ssl_context=context
    ) 