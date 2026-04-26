import os
import re

files = [
    "docs/admin.html", "docs/carrito.html", "docs/clientes.html", "docs/deseos.html",
    "docs/eventos.html", "docs/perfil.html", "docs/play.html", "docs/preventas.html",
    "docs/productoSellado.html", "docs/public.html", "docs/scanner.html",
    "docs/tracking.html", "docs/users.html"
]

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()

    # Remove excessive trailing divs before bottom-nav or body
    # This regex looks for multiple </div> followed by whitespace and then <div class="bottom-nav"> or </body>
    new_content = re.sub(r'(?:\s*</div>\s*){3,}(?=\s*<div class="bottom-nav">|\s*</body>)', '\n    ', content)

    with open(filepath, 'w') as f:
        f.write(new_content)
