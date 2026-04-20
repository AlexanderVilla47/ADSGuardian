# Pasos para fixear credenciales en n8n (30 segundos)

1. Ir a http://168.138.125.21.nip.io:5678
2. Workflows → contract-ui-management-v2
3. Hacer doble click en el nodo "GS Append Alta"
4. Where it says "Credential" → change from "Google Sheets account" to "Google Service Account"
5. Click "Save"
6. Repetir para estos 9 nodos:

✓ GS Append Alta
✓ GS Read For Extension
✓ GS Update Extension
✓ GS Read For Baja
✓ GS Update Baja
✓ GS Read For Listar Ads
✓ GS Append Operation Log
✓ GS Read Operations History
✓ GS Read For Pause Active Preview

 DONE! ✓