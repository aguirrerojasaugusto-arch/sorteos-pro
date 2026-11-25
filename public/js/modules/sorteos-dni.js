export function inicializarBusquedaDNI() {
  const dniInput = document.getElementById('inp-dni');
  if (!dniInput) return;
  
  dniInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
    const dni = e.target.value;
    const statusBadge = document.getElementById('dni-status');
    
    if (dni.length < 8) {
      statusBadge.textContent = '';
      statusBadge.className = 'status-badge';
      setCamposClienteEditable(true);
      return;
    }
    
    statusBadge.textContent = 'Buscando...';
    statusBadge.className = 'status-badge buscando';
    setCamposClienteEditable(false);
    
    clearTimeout(window.dniDebounceTimer);
    window.dniDebounceTimer = setTimeout(() => buscarClientePorDni(dni), 500);
  });
}

async function buscarClientePorDni(dni) {
  const statusBadge = document.getElementById('dni-status');
  try {
    const res = await fetch(`/api/public/cliente/${dni}`);
    const data = await res.json();
    
    if (data.encontrado) {
      document.getElementById('inp-nombres').value = (data.datos.nombres || '').toUpperCase();
      document.getElementById('inp-apellidos').value = (data.datos.apellidos || '').toUpperCase();
      document.getElementById('inp-celular').value = (data.datos.celular || '').toUpperCase();
      
      const selectDepto = document.getElementById('inp-departamento');
      if (data.datos.departamento) {
        selectDepto.value = (data.datos.departamento || '').toUpperCase();
        statusBadge.textContent = '✓ Registrado';
        statusBadge.className = 'status-badge encontrado';
        setCamposClienteEditable(false);
      } else {
        selectDepto.value = '';
        statusBadge.textContent = '✓ Registrado (falta Departamento)';
        statusBadge.className = 'status-badge nuevo';
        setCamposClienteEditable(false);
        selectDepto.disabled = false;
        selectDepto.focus();
      }
    } else {
      statusBadge.textContent = '✗ Nuevo (Se guardará)';
      statusBadge.className = 'status-badge nuevo';
      setCamposClienteEditable(true);
    }
  } catch (error) {
    console.error('Error al buscar cliente:', error);
    statusBadge.textContent = 'Error de red';
    setCamposClienteEditable(true);
  }
}

export function setCamposClienteEditable(esEditable) {
  document.getElementById('inp-nombres').readOnly = !esEditable;
  document.getElementById('inp-apellidos').readOnly = !esEditable;
  document.getElementById('inp-celular').readOnly = !esEditable;
  document.getElementById('inp-departamento').disabled = !esEditable;
}