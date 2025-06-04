import os
import sys
import json
import csv
import datetime
import mimetypes
import socket
from flask import Flask, render_template, request, send_file, jsonify, send_from_directory
from flask_cors import CORS
import webbrowser
from threading import Timer

# Ensure proper MIME types
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('image/png', '.png')
mimetypes.add_type('image/jpeg', '.jpg')
mimetypes.add_type('image/jpeg', '.jpeg')

# Define the base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

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
                         'Forma Fisica', 'Data Ingresso']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            for cylinder in data:
                writer.writerow({
                    'Codice Bombola': cylinder['code'],
                    'Tipo Gas': cylinder['gasType'],
                    'Pressione (bar)': cylinder['pressure'],
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
                         'Pressione Uscita (bar)', 'Data Ingresso', 'Data Uscita',
                         'Consumo (bar)', 'Percentuale Consumo (%)']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            for record in data:
                # Calculate consumption metrics
                pressureIn = float(record['pressureIn'])
                pressureOut = float(record['pressureOut'])
                consumption = pressureIn - pressureOut
                consumption_percentage = (consumption / pressureIn * 100) if pressureIn > 0 else 0
                
                writer.writerow({
                    'Codice Bombola': record['code'],
                    'Tipo Gas': record['gasType'],
                    'Pressione Ingresso (bar)': pressureIn,
                    'Pressione Uscita (bar)': pressureOut,
                    'Data Ingresso': format_date(record['entryDate']),
                    'Data Uscita': format_date(record['exitDate']),
                    'Consumo (bar)': round(consumption, 2),
                    'Percentuale Consumo (%)': round(consumption_percentage, 2)
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
                           'Forma Fisica', 'Data Ingresso'])
            
            for cylinder in stock:
                writer.writerow([
                    cylinder['code'],
                    cylinder['gasType'],
                    cylinder['pressure'],
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
                           'Pressione Uscita (bar)', 'Data Ingresso', 'Data Uscita',
                           'Consumo (bar)', 'Percentuale Consumo (%)'])
            
            for record in history:
                # Calculate consumption metrics
                pressureIn = float(record['pressureIn'])
                pressureOut = float(record['pressureOut'])
                consumption = pressureIn - pressureOut
                consumption_percentage = (consumption / pressureIn * 100) if pressureIn > 0 else 0
                
                writer.writerow([
                    record['code'],
                    record['gasType'],
                    pressureIn,
                    pressureOut,
                    format_date(record['entryDate']),
                    format_date(record['exitDate']),
                    round(consumption, 2),
                    round(consumption_percentage, 2)
                ])
            
            writer.writerow([])
            writer.writerow(['Totale operazioni completate:', len(history)])
            
            # Consumption summary by gas type
            gas_consumption = {}
            for record in history:
                gas = record['gasType']
                pressureIn = float(record['pressureIn'])
                pressureOut = float(record['pressureOut'])
                consumption = pressureIn - pressureOut
                
                if gas in gas_consumption:
                    gas_consumption[gas] += consumption
                else:
                    gas_consumption[gas] = consumption
            
            writer.writerow([])
            writer.writerow(['RIEPILOGO CONSUMO PER TIPO DI GAS'])
            writer.writerow(['Tipo Gas', 'Consumo Totale (bar)'])
            for gas, consumption in gas_consumption.items():
                writer.writerow([gas, round(consumption, 2)])
                
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

def open_browser():
    """Open browser after Flask app starts"""
    # Get local IP address
    local_ip = get_local_ip()
    # Open browser to the local IP address
    webbrowser.open_new(f'http://{local_ip}:5001/')

if __name__ == '__main__':
    # Get local IP address
    local_ip = get_local_ip()
    
    # Open browser automatically
    Timer(1, open_browser).start()
    
    # Print startup message
    print("\n" + "="*80)
    print(" RMIC - Gestione Bombole in Pressione - Server Report".center(80))
    print("="*80)
    print(f" Server avviato: http://{local_ip}:5001/")
    print(f" Accesso locale: http://127.0.0.1:5001/")
    print(f" Directory report: {os.path.abspath(OUTPUT_DIR)}")
    print("="*80)
    print(" Per terminare premere CTRL+C")
    print("="*80 + "\n")
    
    # Start Flask app with network access
    app.run(host='0.0.0.0', port=5001, debug=False) 