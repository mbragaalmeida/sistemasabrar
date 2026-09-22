async function testReturn() {
  const res = await fetch('http://localhost:3001/api/returns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: 1,
      materialId: 1,
      quantity: 50,
      reason: 'Sobra de prumada não utilizada devolvida ao almoxarifado em perfeitas condições',
      userId: 4
    })
  });
  const data = await res.json();
  console.log('--- TESTE DE DEVOLUÇÃO E CONSUMO REAL ---');
  console.log('Código da Devolução:', data.code);
  console.log('Quantidade Devolvida:', data.quantityReturned);
  console.log('Novo Estoque Físico Restaurado:', data.newPhysicalStock);
  console.log('Total Retirado na Obra 1:', data.projectTotalWithdrawn);
  console.log('Total Devolvido na Obra 1:', data.projectTotalReturned);
  console.log('Consumo Real Efetivo (Retirado - Devolvido):', data.actualConsumed);
}

testReturn();
