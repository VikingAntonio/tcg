#!/usr/bin/env python3
"""Regenera las vistas de /offline/ a partir de las del sitio.

Herramienta de mantenimiento: no hace falta para servir el modo sin conexión,
solo cuando cambie una vista del sitio y se quiera reflejar aquí.

Uso, desde la carpeta docs/:

    python3 offline/rebuild-html.py

Las vistas se copian tal cual y solo se cambian las dependencias externas por
copias locales, el cliente de datos (Supabase -> almacén local) y el arranque
del modo sin conexión. Después de ejecutarlo, subir OFFLINE_SHELL_VERSION en
offline/js/offline-version.js.
"""

import pathlib
import re

DOCS = pathlib.Path(__file__).resolve().parent.parent
OUT = DOCS / 'offline'

# Restaura la tienda elegida si la URL llega sin ?store= (atajos del navegador).
HEAD_SNIPPET = """<script>
(function(){try{var p=new URLSearchParams(location.search);if(!p.get('store')&&!p.get('id')&&!p.get('user')){var s=localStorage.getItem('tcg_offline_store');if(s){p.set('store',s);history.replaceState(null,'',location.pathname+'?'+p.toString()+(location.hash||''));}}}catch(e){}})();
</script>
"""

# Canal de tiempo real inerte: en el duelo de práctica el código lo usa aunque
# no haya multijugador.
COMM_CHANNEL_STUB = """<script>
window.commChannel = window.commChannel || {
    on: function () { return this; },
    subscribe: function () { return this; },
    unsubscribe: function () { return this; },
    send: function () { return Promise.resolve('ok'); },
    removeChannel: function () { return Promise.resolve('ok'); }
};
</script>
"""

LIBS = [
    ('https://code.jquery.com/jquery-3.6.0.min.js', 'vendor/jquery.min.js'),
    ('https://cdn.jsdelivr.net/npm/swiper@9/swiper-bundle.min.js', 'vendor/swiper-bundle.min.js'),
    ('https://cdn.jsdelivr.net/npm/swiper@9/swiper-bundle.min.css', 'vendor/swiper-bundle.min.css'),
    ('https://cdn.jsdelivr.net/npm/sweetalert2@11', 'vendor/sweetalert2.all.min.js'),
    ('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', 'vendor/qrcode.min.js'),
    ('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css', 'vendor/fa/all.min.css'),
]

REMOVE_TAGS = [
    r'<script src="https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js@2"></script>\s*',
    r'<script type="module" src="https://ajax\.googleapis\.com/ajax/libs/model-viewer/[^"]+"></script>\s*',
    r'<script async src="https://unpkg\.com/es-module-shims[^"]*"></script>\s*',
    r'<script type="importmap">.*?</script>\s*',
    r'<script src="https://cdn\.jsdelivr\.net/npm/chart\.js"></script>\s*',
    r'<script type="module" src="/js/loading3d\.js"></script>\s*',
    r'<script src="/js/michatbot-mobile3d\.js"></script>\s*',
    r'<script src="/js/michatbot\.js"></script>\s*',
]

SHIM = """<script src="js/offline-version.js"></script>
    <script src="js/offline-db.js"></script>
    <script src="js/offline-supabase.js"></script>
    <script src="js/offline-sync.js"></script>"""

# origen -> archivo dentro de /offline/
PAGES = {
    'public.html': 'index.html',
    'duel.html': 'duel.html',
    'duelmobile.html': 'duelmobile.html',
    'configDuel.html': 'configDuel.html',
    'configDuelMobile.html': 'configDuelMobile.html',
    'magic.html': 'magic.html',
    'magicMobile.html': 'magicMobile.html',
    'configMagic.html': 'configMagic.html',
}


def transform(source_name, target_name):
    source = (DOCS / source_name).read_text(encoding='utf-8')
    html = source

    # Las vistas viven en /offline/, así que los assets van por ruta absoluta.
    html = html.replace('href="css/', 'href="/css/')
    html = html.replace('src="js/', 'src="/js/')
    html = html.replace('href="js/', 'href="/js/')
    html = html.replace('src="css/', 'src="/css/')

    for remote, local in LIBS:
        html = html.replace(remote, local)

    html = re.sub(r'<link href="https://fonts\.googleapis\.com/[^"]+" rel="stylesheet">',
                  '<link rel="stylesheet" href="vendor/fonts.css">', html)
    html = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com/[^"]+">',
                  '<link rel="stylesheet" href="vendor/fonts.css">', html)

    html = html.replace('href="https://vikingtcg.xyz/favi.png"', 'href="/favi.png"')
    html = html.replace('src="https://vikingtcg.xyz/favi.png"', 'src="/favi.png"')
    html = html.replace('<link rel="manifest" href="manifest.json">',
                        '<link rel="manifest" href="manifest.webmanifest">')

    for pattern in REMOVE_TAGS:
        html = re.sub(pattern, '', html, flags=re.S)

    html = re.sub(r"<script>\s*if \('serviceWorker' in navigator\).*?</script>\s*", '', html, flags=re.S)

    html = html.replace('<script src="/js/supabase-config.js"></script>', SHIM)
    if '/js/supabase-config.js' in html:
        raise SystemExit(f'{source_name}: no se reemplazó supabase-config.js')

    html = html.replace('</head>', '    <link rel="stylesheet" href="offline.css">\n</head>', 1)
    html = html.replace('<head>', '<head>\n' + HEAD_SNIPPET, 1)
    if 'duel' in target_name:
        html = html.replace('</head>', COMM_CHANNEL_STUB + '</head>', 1)
    html = html.replace('</body>', '    <script src="js/offline-ui.js"></script>\n</body>', 1)

    (OUT / target_name).write_text(html, encoding='utf-8')
    return len(source), len(html)


def main():
    for source_name, target_name in PAGES.items():
        before, after = transform(source_name, target_name)
        print(f'{source_name} -> offline/{target_name}: {before} -> {after}')


if __name__ == '__main__':
    main()
