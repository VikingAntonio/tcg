/**
 * Vikingdev Binders Integration Library
 * This script handles the <vikingdev-binders> custom element for external site embedding.
 */

(function() {
    // Prevent multiple definitions
    if (customElements.get('vikingdev-binders')) return;

    class VikingdevBinders extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
        }

        static get observedAttributes() {
            return ['domain', 'album-id'];
        }

        attributeChangedCallback() {
            this.render();
        }

        connectedCallback() {
            this.render();
        }

        async render() {
            const domainAttr = this.getAttribute('domain');
            const albumId = this.getAttribute('album-id');
            const currentHostname = window.location.hostname;

            if (!domainAttr || !albumId) {
                this.shadowRoot.innerHTML = `<div style="color: #ff4757; font-family: sans-serif; padding: 20px; text-align: center; border: 1px dashed #ff4757;">Error: Missing configuration attributes (domain, album-id).</div>`;
                return;
            }

            // Normalize domains for comparison
            const cleanDomainAttr = domainAttr.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
            const cleanCurrentHostname = currentHostname.toLowerCase();

            // Injected styles for centering, margins, and responsiveness
            const styles = `
                :host {
                    display: block;
                    width: 100%;
                    max-width: 1200px;
                    margin: 60px auto;
                    font-family: 'Inter', system-ui, -apple-system, sans-serif;
                    box-sizing: border-box;
                }
                .vikingdev-outer {
                    width: 100%;
                    padding: 0 20px;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .vikingdev-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                    background: #ffffff;
                    border: 1px solid #eee;
                    border-radius: 16px;
                    min-height: 300px;
                    width: 100%;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.03);
                    box-sizing: border-box;
                }
                .error-box {
                    color: #ff4757;
                    background: rgba(255, 71, 87, 0.05);
                    border: 1px solid #ff4757;
                    padding: 30px;
                    border-radius: 12px;
                    text-align: center;
                    width: 100%;
                    max-width: 600px;
                    box-sizing: border-box;
                    font-weight: 500;
                }
                .grid-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                    gap: 30px;
                    width: 100%;
                    margin-top: 30px;
                }
                .card-slot {
                    background: #fff;
                    border: 1px solid #f0f0f0;
                    border-radius: 12px;
                    padding: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.04);
                    transition: all 0.3s ease;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .card-slot:hover {
                    transform: translateY(-8px);
                    box-shadow: 0 12px 24px rgba(0,0,0,0.08);
                    border-color: #00d2ff;
                }
                .card-img-wrapper {
                    width: 100%;
                    position: relative;
                    padding-top: 140%; /* 2.5 / 3.5 aspect ratio */
                    overflow: hidden;
                    border-radius: 6px;
                    background: #f8f9fa;
                }
                .card-img {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
                .card-info {
                    margin-top: 15px;
                    text-align: center;
                    width: 100%;
                }
                .card-name {
                    font-size: 14px;
                    font-weight: 700;
                    margin: 0;
                    color: #1a1a1a;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .card-price {
                    font-size: 13px;
                    color: #00d2ff;
                    font-weight: 800;
                    margin-top: 6px;
                }
                .loader {
                    width: 50px;
                    height: 50px;
                    border: 5px solid #f3f3f3;
                    border-top: 5px solid #00d2ff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                .viking-badge {
                    margin-top: 40px;
                    font-size: 11px;
                    color: #aaa;
                    text-transform: uppercase;
                    letter-spacing: 0.2em;
                    font-weight: 700;
                    text-decoration: none;
                    transition: color 0.2s;
                }
                .viking-badge:hover { color: #00d2ff; }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @media (max-width: 768px) {
                    :host { margin: 30px auto; }
                    .grid-container {
                        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                        gap: 15px;
                    }
                    .card-name { font-size: 12px; }
                    .vikingdev-container { padding: 20px 15px; }
                }
            `;

            this.shadowRoot.innerHTML = `
                <style>${styles}</style>
                <div class="vikingdev-outer">
                    <div class="vikingdev-container">
                        <div class="loader"></div>
                    </div>
                </div>
            `;

            try {
                const SUPABASE_URL = 'https://ehszvqwftqgxjggnbcmt.supabase.co';
                const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoc3p2cXdmdHFneGpnZ25iY210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDI5MjAsImV4cCI6MjA4NTMxODkyMH0.wh8_Xy4_w9roFxMgbJ-J9A3r5V7duUjnStl4ZsZ0804';

                // 1. Fetch User by domain and check authorization
                const userResponse = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?custom_domain=eq.${cleanDomainAttr}&select=id,custom_domain`, {
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                });
                const users = await userResponse.json();
                const owner = users && users.length > 0 ? users[0] : null;

                if (!owner) {
                    this.renderError(`Error: Domain "${cleanDomainAttr}" not authorized or user not found.`);
                    return;
                }

                // Domain check: current site must match the authorized domain
                if (cleanCurrentHostname !== cleanDomainAttr && cleanCurrentHostname !== 'localhost' && cleanCurrentHostname !== '127.0.0.1') {
                     this.renderError(`Error: Current domain "${cleanCurrentHostname}" does not match authorized domain "${cleanDomainAttr}".`);
                     return;
                }

                // 2. Fetch Album data
                const pagesResponse = await fetch(`${SUPABASE_URL}/rest/v1/album_pages?album_id=eq.${albumId}&select=id&order=position`, {
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                });
                const pages = await pagesResponse.json();

                if (!pages || pages.length === 0) {
                    this.renderError("No pages found for this album.");
                    return;
                }

                const pageIds = pages.map(p => p.id).join(',');
                const slotsResponse = await fetch(`${SUPABASE_URL}/rest/v1/card_slots?page_id=in.(${pageIds})&select=name,image_url,price&order=slot_index`, {
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                });
                const slots = await slotsResponse.json();

                this.renderContent(slots);

            } catch (err) {
                console.error(err);
                this.renderError("Failed to load content. Please check your connection.");
            }
        }

        renderError(msg) {
            this.shadowRoot.querySelector('.vikingdev-container').innerHTML = `
                <div class="error-box">
                    <div style="font-size: 24px; margin-bottom: 10px;">⚠️</div>
                    <strong>VIKINGDEV BINDERS</strong><br>
                    <span style="font-size: 14px; margin-top: 8px; display: block; opacity: 0.8;">${msg}</span>
                </div>
            `;
        }

        renderContent(slots) {
            const validSlots = (slots || []).filter(s => s.image_url);

            if (validSlots.length === 0) {
                this.shadowRoot.querySelector('.vikingdev-container').innerHTML = `<div style="color: #666; font-weight: 500;">Este álbum no contiene cartas visibles.</div>`;
                return;
            }

            const gridHtml = validSlots.map(slot => `
                <div class="card-slot">
                    <div class="card-img-wrapper">
                        <img class="card-img" src="${slot.image_url}" loading="lazy">
                    </div>
                    <div class="card-info">
                        <p class="card-name">${slot.name || 'Carta de Colección'}</p>
                        ${slot.price ? `<p class="card-price">${slot.price}</p>` : ''}
                    </div>
                </div>
            `).join('');

            this.shadowRoot.querySelector('.vikingdev-container').innerHTML = `
                <h2 style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 1.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em;">Nuestra Colección</h2>
                <div style="width: 60px; height: 4px; background: #00d2ff; border-radius: 2px; margin-bottom: 30px;"></div>
                <div class="grid-container">${gridHtml}</div>
                <a href="https://vikingtcg.xyz" target="_blank" class="viking-badge">Powered by Vikingdev TCG</a>
            `;
        }
    }

    customElements.define('vikingdev-binders', VikingdevBinders);
})();
