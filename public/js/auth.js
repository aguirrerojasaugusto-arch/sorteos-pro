const modal = document.getElementById('modal-login');

document.getElementById('nav-login').addEventListener('click', (e) => {
  e.preventDefault();
  modal.classList.remove('hidden');
});
document.getElementById('btn-cerrar-modal').addEventListener('click', () => {
  modal.classList.add('hidden');
});

document.getElementById('btn-login').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error);
  localStorage.setItem('token', data.token);
  localStorage.setItem('usuario_id', data.usuario.id);
  localStorage.setItem('usuario_nombre', data.usuario.nombre);
  alert(`Bienvenido ${data.usuario.nombre}`);
  window.location.reload();
});

document.getElementById('btn-register').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const nombre = prompt('Nombre completo:');
  const dni = prompt('DNI (8 dígitos):');
  if (!nombre || !dni) return;
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, nombre, dni })
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error);
  localStorage.setItem('token', data.token);
  localStorage.setItem('usuario_id', data.usuario.id);
  alert('Cuenta creada');
  window.location.reload();
});

// Mostrar cuenta si logueado
if (localStorage.getItem('token')) {
  document.getElementById('nav-cuenta').classList.remove('hidden');
  document.getElementById('nav-login').classList.add('hidden');
}