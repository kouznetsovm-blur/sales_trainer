import { useState, useEffect } from 'react';
import { authFetch } from '../utils/api.js';
import './TestSelect.css';

export default function TestSelect({ value, onChange }) {
  const [tests, setTests] = useState([]);

  useEffect(() => {
    authFetch('/api/tests')
      .then(res => res.ok ? res.json() : [])
      .then(data => setTests(data))
      .catch(() => {});
  }, []);

  return (
    <select
      className="test-select"
      value={value ?? ''}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="" disabled>Выберите тест</option>
      {tests.map(t => (
        <option key={t.id} value={t.id}>{t.title}</option>
      ))}
    </select>
  );
}
