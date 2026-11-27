// Stub de notificaciones para el modo sin conexión: no hay servidor al que
// consultar, así que la campana no se muestra y las APIs quedan inertes.
(function () {
    window.VikingNotifications = window.VikingNotifications || {
        refresh: function () {},
        init: function () {},
        open: function () {},
        markAllRead: function () {}
    };
    window.openNotifImageModal = window.openNotifImageModal || function () {};
    window.claimGiftItem = window.claimGiftItem || function () {};
})();
