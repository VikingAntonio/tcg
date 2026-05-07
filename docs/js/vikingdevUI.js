/**
 * Vikingdev Binders Integration Library
 * This script handles the <vikingdev-binders> custom element for external site embedding.
 * Version 2.0: Iframe-based for perfect visual fidelity.
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
            return ['user', 'album-id'];
        }

        attributeChangedCallback() {
            this.render();
        }

        connectedCallback() {
            this.render();
        }

        render() {
            const user = this.getAttribute('user');
            const albumId = this.getAttribute('album-id');

            if (!user || !albumId) {
                this.shadowRoot.innerHTML = `<div style="color: #ff4757; font-family: sans-serif; padding: 20px; text-align: center; border: 1px dashed #ff4757;">Error: Missing configuration attributes (user, album-id).</div>`;
                return;
            }

            const baseUrl = 'https://vikingtcg.xyz/public.html';
            // Important: we pass embed=true to trigger the clean UI and authorization check
            const embedUrl = `${baseUrl}?user=${encodeURIComponent(user)}&view=albums&albumId=${albumId}&embed=true`;

            // Responsive sizing logic
            const styles = `
                :host {
                    display: block;
                    width: 100%;
                    max-width: 1000px;
                    margin: 40px auto;
                    box-sizing: border-box;
                    overflow: hidden;
                }
                .vikingdev-wrapper {
                    position: relative;
                    width: 100%;
                    padding-bottom: 75%; /* Responsive Aspect Ratio 4:3ish */
                    height: 0;
                    background: transparent;
                }
                @media (max-width: 640px) {
                    .vikingdev-wrapper {
                        padding-bottom: 120%; /* Taller for mobile binders */
                    }
                    :host {
                        margin: 20px auto;
                    }
                }
                iframe {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    border: none;
                    background: transparent;
                }
                .viking-badge {
                    display: block;
                    text-align: center;
                    margin-top: 15px;
                    font-family: sans-serif;
                    font-size: 10px;
                    color: #aaa;
                    text-decoration: none;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    font-weight: 700;
                }
                .viking-badge:hover { color: #00d2ff; }
            `;

            this.shadowRoot.innerHTML = `
                <style>${styles}</style>
                <div class="vikingdev-wrapper">
                    <iframe src="${embedUrl}" allow="gyroscope; accelerometer" allowtransparency="true"></iframe>
                </div>
                <a href="https://vikingtcg.xyz" target="_blank" class="viking-badge">Powered by Vikingdev TCG</a>
            `;
        }
    }

    customElements.define('vikingdev-binders', VikingdevBinders);
})();
