'use client';

export default function ErrorPage() {
  return (
    <main
      style={{
        padding: 60,
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
        color: '#0D0D0D',
        background: '#FAFAFA',
        minHeight: '100vh',
      }}
    >
      <h1 style={{ fontSize: 28, margin: '0 0 12px' }}>Щось пішло не так</h1>
      <p style={{ fontSize: 16, margin: 0, color: '#7A7A7A' }}>
        Спробуйте оновити сторінку за хвилину.
      </p>
    </main>
  );
}
