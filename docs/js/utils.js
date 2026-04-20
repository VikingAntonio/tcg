// parseDateSafe.js - Shared date parsing utility
function parseDateSafe(dateStr) {
    if (!dateStr) return null;
    // Normalize "A" -> "AM", "P" -> "PM"
    let normalized = dateStr.replace(/ A$/, ' AM').replace(/ P$/, ' PM');

    let d = new Date(normalized);
    if (!isNaN(d.getTime())) return d;

    // Handle "YYYY-MM-DD hh:mm AM/PM"
    const regex = /^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2}) (AM|PM)$/;
    const match = normalized.match(regex);
    if (match) {
        let [_, year, month, day, hours, minutes, meridiem] = match;
        year = parseInt(year);
        month = parseInt(month) - 1;
        day = parseInt(day);
        hours = parseInt(hours);
        minutes = parseInt(minutes);

        if (meridiem === 'PM' && hours < 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;

        return new Date(year, month, day, hours, minutes);
    }

    // Try replacing space with T as fallback
    d = new Date(normalized.replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
}

window.parseDateSafe = parseDateSafe;
