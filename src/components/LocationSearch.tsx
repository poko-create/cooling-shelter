import { useState } from 'react';

export function LocationSearch({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 p-2 bg-white rounded shadow">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="現在地を入力 (例: 東京駅, コンビニ)">
      </input>
      <button type="submit" className="ml-2 px-3 py-1 bg-blue-500 text-white rounded">
        検索
      </button>
    </form>
  );
}