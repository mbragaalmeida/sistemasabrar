async function testDelivery() {
  const reqId = 4; // SOL-2026-0004
  await fetch(`http://localhost:3001/api/requests/${reqId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Em separação', userId: 4 })
  });
  console.log('1. Status atualizado para: Em separação');

  await fetch(`http://localhost:3001/api/requests/${reqId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Separado', userId: 4 })
  });
  console.log('2. Status atualizado para: Separado');

  const res = await fetch(`http://localhost:3001/api/requests/${reqId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Entregue', userId: 4 })
  });
  const data = await res.json();
  console.log('3. Status final:', data.newStatus);

  // Consulta saldo atual do material 1
  const matRes = await fetch('http://localhost:3001/api/materials/1');
  const mat = await matRes.json();
  console.log('--- SALDO ATUAL DO CABO 10MM² APÓS ENTREGA ---');
  console.log('Estoque Físico:', mat.stock_physical);
  console.log('Estoque Reservado:', mat.stock_reserved);
  console.log('Estoque Disponível:', mat.stock_available);
}

testDelivery();
