async function testReceipt() {
  const res = await fetch('http://localhost:3001/api/purchases/3/receive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 5 })
  });
  const data = await res.json();
  console.log('--- TESTE DE RECEBIMENTO DE COMPRA ---');
  console.log('Compra Recebida:', data.code);
  console.log('Material:', data.materialName);
  console.log('Quantidade Recebida:', data.quantityReceived);
  console.log('Novo Estoque Físico Atualizado:', data.newStock);
}

testReceipt();
