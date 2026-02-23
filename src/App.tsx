import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Mic, Camera, Search, Plus, Baby, ShoppingCart, X, TrendingUp, Loader2
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function App() {
  const [itens, setItens] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<'Pendentes' | 'Comprados'>('Pendentes');
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todas');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [novoItemNome, setNovoItemNome] = useState('');

  const categorias = ['Todas', 'Utilidades', 'Móveis', 'Enxoval e Vestuário', 'Alimentação', 'Higiene', 'Mamãe', 'Brinquedos', 'Outros'];

  useEffect(() => { fetchEnxoval(); }, []);

  async function fetchEnxoval() {
    setLoading(true);
    const { data } = await supabase.from('enxoval').select('*').eq('interesse', 'Ativo').order('item_nome');
    if (data) setItens(data);
    setLoading(false);
  }

  const comprimirImagem = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx?.canvas.toBlob((blob) => resolve(blob as Blob), 'image/jpeg', 0.7);
        };
      };
    });
  };

  async function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      if (!e.target.files || e.target.files.length === 0 || !editando) return;
      setUploading(true);
      const arquivoOriginal = e.target.files[0];
      const fotoComprimida = await comprimirImagem(arquivoOriginal);
      const fileName = `${editando.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('fotos-enxoval').upload(fileName, fotoComprimida);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('fotos-enxoval').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('enxoval').update({ foto_url: publicUrl }).eq('id', editando.id);
      if (updateError) throw updateError;
      setEditando({ ...editando, foto_url: publicUrl });
      fetchEnxoval();
    } catch (error: any) { alert(error.message); } finally { setUploading(false); }
  }

  async function adicionarItem() {
    if (!novoItemNome.trim()) return;
    const { error } = await supabase.from('enxoval').insert([{ item_nome: novoItemNome, categoria: 'Outros', interesse: 'Ativo', status: 'Pendente' }]);
    if (!error) { setNovoItemNome(''); setMostrarModal(false); fetchEnxoval(); }
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    const { error } = await supabase.from('enxoval').update({
      marca: editando.marca, preco_pago: editando.preco_pago, local_compra: editando.local_compra,
      data_compra: editando.data_compra, condicao: editando.condicao, status: editando.status, categoria: editando.categoria
    }).eq('id', editando.id);
    if (!error) { setEditando(null); fetchEnxoval(); }
  }

  const totalGasto = itens.filter(i => i.status === 'Comprado').reduce((acc, i) => acc + Number(i.preco_pago || 0), 0);

  const escutarVoz = (callback: (texto: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.onresult = (event: any) => callback(event.results[0][0].transcript);
    recognition.start();
  };

  const itensFiltrados = itens.filter(i => {
    const statusMatch = abaAtiva === 'Pendentes' ? i.status === 'Pendente' : (i.status === 'Comprado' || i.status === 'Presente');
    const catMatch = categoriaAtiva === 'Todas' || i.categoria === categoriaAtiva;
    return statusMatch && catMatch && (i.item_nome ?? '').toLowerCase().includes(busca.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 w-full flex flex-col">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 w-full">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-lg font-black text-indigo-600 tracking-tight leading-none">Jurandir Baby 🍼</h1>
          <div className="flex items-center gap-2">
             <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                <button onClick={() => setAbaAtiva('Pendentes')} className={`px-2 py-1 rounded-md text-[9px] font-bold ${abaAtiva === 'Pendentes' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>FALTAM</button>
                <button onClick={() => setAbaAtiva('Comprados')} className={`px-2 py-1 rounded-md text-[9px] font-bold ${abaAtiva === 'Comprados' ? 'bg-white shadow-sm text-green-600' : 'text-slate-500'}`}>TEMOS</button>
             </div>
             <div className="bg-green-50 px-2 py-1 rounded-lg flex items-center gap-1 border border-green-100">
               <TrendingUp size={10} className="text-green-500" />
               <span className="text-[10px] font-bold text-green-700">R$ {totalGasto.toFixed(2)}</span>
             </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
              <input className="w-full rounded-lg bg-slate-100 py-1.5 pl-9 pr-4 text-xs outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <button onClick={() => escutarVoz(setBusca)} className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600"><Mic size={16}/></button>
          </div>
          <div className="flex flex-wrap gap-1">
            {categorias.map(cat => (
              <button key={cat} onClick={() => setCategoriaAtiva(cat)} className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${categoriaAtiva === cat ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-200'}`}>{cat}</button>
            ))}
          </div>
        </div>
      </header>

      <main className="p-3 space-y-2 w-full flex-1">
        {loading ? ( <div className="text-center py-10 text-slate-400 text-xs font-bold animate-pulse uppercase">Sincronizando...</div> ) : (
          itensFiltrados.map((item) => (
            <div key={item.id} onClick={() => setEditando(item)} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex flex-col gap-2 active:bg-slate-50">
              <div className="flex gap-3">
                <div className="h-12 w-12 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 overflow-hidden text-slate-300">
                  {item.foto_url ? <img src={item.foto_url} className="h-full w-full object-cover" /> : <Camera size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-wider truncate">{item.categoria}</span>
                    {item.condicao && <span className="text-[7px] px-1 rounded font-bold text-white uppercase bg-blue-400">{item.condicao}</span>}
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm truncate leading-tight">{item.item_nome}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {item.marca && <span className="text-[9px] text-slate-500">{item.marca}</span>}
                    {item.status === 'Comprado' && <span className="text-[9px] font-black text-indigo-600">R$ {Number(item.preco_pago).toFixed(2)}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-8 py-2 flex justify-around items-center z-30">
        <ShoppingCart size={20} className="text-indigo-600" />
        <button onClick={() => setMostrarModal(true)} className="bg-indigo-600 p-2.5 rounded-full text-white shadow-lg -mt-8 border-4 border-slate-50 active:scale-95 transition-transform"><Plus size={20}/></button>
        <Baby size={20} className="text-slate-300" />
      </nav>

      {editando && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end">
          <form onSubmit={salvarEdicao} className="bg-white w-full rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2"><h2 className="text-sm font-black text-slate-800 uppercase">{editando.item_nome}</h2><button type="button" onClick={() => setEditando(null)}><X size={20}/></button></div>
            <div className="flex justify-center">
              <div className="relative h-24 w-24 rounded-xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                {editando.foto_url ? <img src={editando.foto_url} className="h-full w-full object-cover" /> : <Camera size={24} className="text-slate-300" />}
                <label className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUploadFoto} disabled={uploading} />
                  {uploading ? <Loader2 className="animate-spin text-white" /> : <Plus className="text-white" />}
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="bg-slate-100 p-3 rounded-xl text-xs outline-none" placeholder="Marca" value={editando.marca || ''} onChange={e => setEditando({...editando, marca: e.target.value})} />
              <input type="number" step="0.01" className="bg-slate-100 p-3 rounded-xl text-xs font-bold text-indigo-600" placeholder="Preço" value={editando.preco_pago || ''} onChange={e => setEditando({...editando, preco_pago: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="bg-slate-100 p-3 rounded-xl text-xs" placeholder="Local" value={editando.local_compra || ''} onChange={e => setEditando({...editando, local_compra: e.target.value})} />
              <input type="date" className="bg-slate-100 p-3 rounded-xl text-xs" value={editando.data_compra || ''} onChange={e => setEditando({...editando, data_compra: e.target.value})} />
            </div>
            <select className="w-full bg-slate-100 p-3 rounded-xl text-xs font-bold" value={editando.categoria || 'Outros'} onChange={e => setEditando({...editando, categoria: e.target.value})}>
              {categorias.filter(c => c !== 'Todas').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
               {['Novo', 'Usado'].map(c => <button key={c} type="button" onClick={() => setEditando({...editando, condicao: c as any})} className={`flex-1 py-2 rounded-lg text-[9px] font-bold ${editando.condicao === c ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>{c}</button>)}
            </div>
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
              {['Pendente', 'Comprado', 'Presente'].map(s => <button key={s} type="button" onClick={() => setEditando({...editando, status: s as any})} className={`flex-1 py-2 rounded-lg text-[9px] font-bold ${editando.status === s ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>{s.toUpperCase()}</button>)}
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl text-xs">SALVAR</button>
          </form>
        </div>
      )}

      {mostrarModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end">
          <div className="bg-white w-full rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6"><h2 className="text-sm font-black text-slate-800 uppercase">Novo Item</h2><button onClick={() => setMostrarModal(false)}><X size={20}/></button></div>
            <div className="flex gap-2 mb-6">
              <input autoFocus className="flex-1 bg-slate-100 p-3 rounded-xl outline-none text-sm font-bold" value={novoItemNome} onChange={e => setNovoItemNome(e.target.value)} />
              <button onClick={() => escutarVoz(setNovoItemNome)} className="bg-indigo-50 text-indigo-600 p-3 rounded-xl"><Mic size={20}/></button>
            </div>
            <button onClick={adicionarItem} className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl text-sm">ADICIONAR</button>
          </div>
        </div>
      )}
    </div>
  );
}
