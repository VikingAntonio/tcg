// ====================================================================
// GEMINI AI PREVENTAS HELPER / HANDLER (supabase/functions/preventas.ts)
// ====================================================================
// Permite a Gemini consultar la tabla public.preorders en Supabase,
// revisar reservas de clientes (anticipos, saldos pendientes, estados)
// y actualizar estados de pago o entrega cuando el usuario lo solicite.

export interface PreorderClientReservation {
  id?: number | string;
  name?: string;
  qty?: number;
  deposit?: number;
  status_payment?: 'Pendiente' | 'Pago Parcial' | 'Liquidado' | string;
  status_delivery?: 'Por Entregar' | 'En Camino' | 'Entregado' | 'Retrasado' | string;
  status?: string;
  created_at?: string;
}

export interface PreorderRecord {
  id: string;
  user_id: string;
  name: string;
  price?: string;
  reserve_amount?: string;
  max_stock?: number;
  clients_list?: PreorderClientReservation[] | string;
  payment_deadline?: string;
  arrival_date?: string;
  tcg?: string;
  is_public?: boolean;
}

export function isPreorderQueryOrUpdateIntent(promptText: string): boolean {
  if (!promptText) return false;
  const lower = promptText.toLowerCase();
  return (
    lower.includes('preventa') ||
    lower.includes('reserva') ||
    lower.includes('anticipo') ||
    lower.includes('cuanto dio') ||
    lower.includes('cuánto dio') ||
    lower.includes('ya pago') ||
    lower.includes('ya pagó') ||
    lower.includes('liquidó') ||
    lower.includes('liquidado') ||
    lower.includes('quien apartado') ||
    lower.includes('quién apartado') ||
    lower.includes('cliente')
  );
}

export function buildPreordersPromptContext(preorders: PreorderRecord[], isAdmin: boolean): string {
  if (!preorders || preorders.length === 0) {
    return 'NO HAY PREVENTAS REGISTRADAS EN ESTA TIENDA.';
  }

  let text = '--- INFORMACIÓN COMPLETA DE PREVENTAS Y CLIENTES ---\n';

  preorders.forEach(p => {
    let clients: PreorderClientReservation[] = [];
    if (typeof p.clients_list === 'string') {
      try { clients = JSON.parse(p.clients_list); } catch (e) { clients = []; }
    } else if (Array.isArray(p.clients_list)) {
      clients = p.clients_list;
    }

    const maxStock = Number(p.max_stock) || 0;
    const totalReserved = clients.reduce((sum, c) => sum + (Number(c.qty) || 0), 0);
    const totalAvailable = Math.max(0, maxStock - totalReserved);
    const unitPrice = parseFloat((p.price || '0').toString().replace(/[^0-9.]/g, '')) || 0;

    text += `\n* PREVENTA ID: ${p.id}\n`;
    text += `  Nombre: ${p.name}\n`;
    text += `  Precio Lista: ${p.price || 'N/A'} | Aparta Desde: ${p.reserve_amount || 'N/A'}\n`;
    text += `  Stock Total: ${maxStock} | Reservados: ${totalReserved} | Disponibles: ${totalAvailable}\n`;
    text += `  Límite Pago: ${p.payment_deadline || 'N/A'} | Llegada Estimada: ${p.arrival_date || 'N/A'}\n`;

    if (isAdmin) {
      if (clients.length === 0) {
        text += `  Lista de Clientes (Privada): Sin clientes en esta preventa.\n`;
      } else {
        text += `  Lista de Clientes (Privada):\n`;
        clients.forEach((c, idx) => {
          const qty = Number(c.qty) || 1;
          const deposit = Number(c.deposit) || 0;
          const totalCost = unitPrice * qty;
          const remaining = Math.max(0, totalCost - deposit);
          const pStatus = c.status_payment || c.status || (deposit >= totalCost && totalCost > 0 ? 'Liquidado' : (deposit > 0 ? 'Pago Parcial' : 'Pendiente'));
          const dStatus = c.status_delivery || 'Por Entregar';

          text += `    [${idx + 1}] Cliente: "${c.name}" | Cantidad: ${qty} | Anticipo dado: $${deposit.toFixed(2)} | Falta por pagar: $${remaining.toFixed(2)} | Estado Pago: ${pStatus} | Estado Entrega: ${dStatus}\n`;
        });
      }
    } else {
      text += `  Disponibilidad para cliente: ${totalAvailable > 0 ? `${totalAvailable} unidades disponibles` : 'Agotado'}\n`;
    }
  });

  return text;
}
