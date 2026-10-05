// TCG Dual - Shopping Cart Logic
// Managed via localStorage

const Cart = {
    KEY: 'tcg_cart_items',

    getAll: function() {
        const items = localStorage.getItem(this.KEY);
        return items ? JSON.parse(items) : [];
    },

    add: function(card) {
        const items = this.getAll();
        const selectedQty = parseInt(card.cart_quantity) || 1;
        const maxQty = parseInt(card.max_quantity || card.quantity) || 999;

        const existingIdx = items.findIndex(item =>
            item.name === card.name &&
            item.image_url === card.image_url &&
            (item.price || '') === (card.price || '') &&
            (item.rarity || '') === (card.rarity || '') &&
            (item.expansion || '') === (card.expansion || '') &&
            (item.unit_deposit !== undefined ? item.unit_deposit : '') === (card.unit_deposit !== undefined ? card.unit_deposit : '')
        );

        if (existingIdx !== -1) {
            const currentQty = parseInt(items[existingIdx].cart_quantity) || 1;
            const newQty = Math.min(maxQty, currentQty + selectedQty);
            items[existingIdx].cart_quantity = newQty;
            items[existingIdx].max_quantity = maxQty;
            if (items[existingIdx].unit_deposit !== undefined && items[existingIdx].unit_deposit !== null) {
                items[existingIdx].custom_payment_amount = items[existingIdx].unit_deposit * newQty;
            }
        } else {
            items.push({
                ...card,
                cart_quantity: Math.min(maxQty, selectedQty),
                max_quantity: maxQty,
                cart_id: Date.now() + Math.random().toString(36).substr(2, 9)
            });
        }
        localStorage.setItem(this.KEY, JSON.stringify(items));
        this.updateBadge();
    },

    updateQuantity: function(cartId, newQty) {
        const items = this.getAll();
        const item = items.find(i => i.cart_id === cartId);
        if (item) {
            const maxQty = parseInt(item.max_quantity || item.quantity) || 999;
            const validQty = Math.min(maxQty, Math.max(1, parseInt(newQty) || 1));
            item.cart_quantity = validQty;
            if (item.unit_deposit !== undefined && item.unit_deposit !== null) {
                item.custom_payment_amount = item.unit_deposit * validQty;
            }
            localStorage.setItem(this.KEY, JSON.stringify(items));
            this.updateBadge();
        }
    },

    remove: function(cartId) {
        let items = this.getAll();
        items = items.filter(item => item.cart_id !== cartId);
        localStorage.setItem(this.KEY, JSON.stringify(items));
        this.updateBadge();
    },

    clear: function() {
        localStorage.removeItem(this.KEY);
        this.updateBadge();
    },

    getCount: function() {
        const items = this.getAll();
        return items.reduce((sum, item) => sum + (parseInt(item.cart_quantity) || 1), 0);
    },

    getTotal: function() {
        const items = this.getAll();
        return items.reduce((sum, item) => {
            const qty = parseInt(item.cart_quantity) || 1;
            if (item.unit_deposit !== undefined && item.unit_deposit !== null) {
                return sum + (parseFloat(item.unit_deposit) * qty);
            }
            const priceStr = (item.price || "0").toString().replace(/[^0-9.,]/g, '').replace(',', '.');
            const price = parseFloat(priceStr) || 0;
            return sum + (price * qty);
        }, 0);
    },

    updateBadge: function() {
        const count = this.getCount();
        $('#cart-count').text(count);
        if (count > 0) {
            $('#cart-count').show();
        } else {
            $('#cart-count').hide();
        }
    }
};

// Initialize badge on load if jQuery is present
$(document).ready(function() {
    Cart.updateBadge();
});
