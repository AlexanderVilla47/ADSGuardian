import urllib.request
import json

url = "http://168.138.125.21:5678/api/v1/workflows/rpnGFPo0nDthwzdB"
api_key = "__REDACTED_N8N_API_KEY__"
headers = {"X-N8N-API-KEY": api_key}

# GET workflow
req = urllib.request.Request(url, headers=headers)
resp = urllib.request.urlopen(req)
workflow = json.loads(resp.read().decode())

# Update positions and names
position_map = {
    "1": [250, 100], "2": [470, 100], "3": [690, 300], "4": [910, 300],
    "5": [1130, 500], "6": [1350, 500], "7": [1570, 500],
    "8": [1130, 700], "9": [1350, 700], "10": [1570, 700],
    "11": [1130, 900], "12": [1350, 900], "13": [1570, 900], "14": [1790, 900],
    "15": [690, 1100], "16": [910, 1100],
    "17": [1130, 1100], "18": [1130, 1250]
}

name_map = {
    "1": "Webhook UI", "2": "Normalize Request", "3": "Validate Input", "4": "Route Action",
    "5": "Build Alta Row", "6": "GS Append Alta", "7": "Respond Alta",
    "8": "GS Read Contratos", "9": "Filter Proximos Vencer", "10": "Respond Consulta",
    "11": "GS Read For Extension", "12": "Build Extension Row", "13": "GS Update Extension", "14": "Respond Extension",
    "15": "Build Internal Payload F1->F2", "16": "Execute F2 Internal",
    "17": "Log F1 Chain Dispatch OK", "18": "Log F1 Chain Dispatch Error"
}

for node in workflow["nodes"]:
    node_id = node["id"]
    if node_id in position_map:
        node["position"] = position_map[node_id]
    if node_id in name_map:
        node["name"] = name_map[node_id]

# Only name, nodes, connections - minimal body
body = json.dumps({
    "name": workflow["name"],
    "nodes": workflow["nodes"],
    "connections": workflow["connections"]
}).encode('utf-8')

# PUT with error handling
try:
    put_req = urllib.request.Request(url, data=body, headers=headers, method='PUT')
    put_req.add_header('Content-Type', 'application/json')
    put_resp = urllib.request.urlopen(put_req)
    print(f"Status: {put_resp.status}")
    print(put_resp.read().decode())
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode()}")