import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Mic, Camera, Search, Plus, Baby, ShoppingCart, X, Loader2, ChevronDown, Heart
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
    setLoading(true);
    const { error } = await supabase.from('enxoval').update({
      marca: editando.status === 'Presente' ? null : editando.marca,
      preco_pago: editando.status === 'Presente' ? 0 : editando.preco_pago,
      local_compra: editando.status === 'Presente' ? null : editando.local_compra,
      data_compra: editando.data_compra,
      condicao: editando.status === 'Presente' ? 'Novo' : editando.condicao,
      status: editando.status,
      categoria: editando.categoria,
      quem_presenteou: editando.quem_presenteou
    }).eq('id', editando.id);
    
    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      setEditando(null);
      fetchEnxoval();
    }
    setLoading(false);
  }

  const totalGasto = itens.filter(i => i.status === 'Comprado').reduce((acc, i) => acc + Number(i.preco_pago || 0), 0);

  const escutarVoz = (callback: (texto: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 w-full flex flex-col overflow-x-hidden">
      
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 w-full shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-lg font-black text-indigo-600 leading-none">Jurandir Baby 🍼</h1>
          <div className="flex items-center gap-2">
             <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                <button onClick={() => setAbaAtiva('Pendentes')} className={`px-2 py-1 rounded-md text-[9px] font-bold ${abaAtiva === 'Pendentes' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>FALTAM</button>
                <button onClick={() => setAbaAtiva('Comprados')} className={`px-2 py-1 rounded-md text-[9px] font-bold ${abaAtiva === 'Comprados' ? 'bg-white shadow-sm text-green-600' : 'text-slate-500'}`}>TEMOS</button>
             </div>
             <div className="bg-green-50 px-2 py-1 rounded-lg border border-green-100">
               <span className="text-[10px] font-black text-green-700 font-mono">R$ {totalGasto.toFixed(2)}</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-8 relative">
            <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-500" />
            <input className="w-full rounded-xl bg-slate-100 py-2.5 pl-9 pr-4 text-base outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold placeholder:text-slate-400 placeholder:font-normal" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <div className="col-span-4 relative">
            <select value={categoriaAtiva} onChange={(e) => setCategoriaAtiva(e.target.value)} className="w-full bg-indigo-600 text-white text-[10px] font-bold py-3 px-2 rounded-xl appearance-none outline-none shadow-sm">
              {categorias.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-3.5 h-3 w-3 text-white pointer-events-none" />
          </div>
        </div>
      </header>

      <main className="p-3 space-y-3 w-full flex-1 mb-24">
        {loading && !editando ? ( <div className="text-center py-10 text-slate-400 text-xs font-bold animate-pulse uppercase">Sincronizando...</div> ) : (
          itensFiltrados.map((item) => (
            <div key={item.id} onClick={() => setEditando(item)} className="bg-white rounded-2xl p-4 shadow-md border border-slate-100 flex flex-col gap-2 active:bg-slate-50 transition-all">
              <div className="flex gap-4">
                <div className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 overflow-hidden shadow-inner">
                  {item.foto_url ? <img src={item.foto_url} className="h-full w-full object-cover" /> : <Camera size={24} className="text-slate-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest truncate pr-2">{item.categoria}</span>
                    {item.condicao && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-black text-white uppercase bg-indigo-600 shadow-sm">{item.condicao}</span>}
                  </div>
                  <h3 className="font-bold text-slate-900 text-[16px] truncate leading-tight">{item.item_nome}</h3>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {item.marca && <span className="text-[11px] font-bold text-slate-500">{item.marca}</span>}
                    {item.status === 'Comprado' && <span className="text-[13px] font-black text-indigo-700">R$ {Number(item.preco_pago).toFixed(2)}</span>}
                    {item.status === 'Presente' && <span className="text-[11px] font-bold text-pink-600 flex items-center gap-1 uppercase italic tracking-tighter"><Heart size={10} fill="currentColor"/> {item.quem_presenteou || 'Alguém especial'}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-10 py-4 pb-8 flex justify-around items-center z-30 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
        <ShoppingCart size={24} className="text-indigo-600" />
        <button onClick={() => setMostrarModal(true)} className="bg-indigo-600 p-4 rounded-full text-white shadow-xl -mt-14 border-4 border-slate-50 active:scale-90 transition-all"><Plus size={28}/></button>
        <Baby size={24} className="text-slate-300" />
      </nav>

      {editando && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end justify-center overflow-hidden">
          <form onSubmit={salvarEdicao} className="bg-white w-full max-w-md rounded-t-[2.5rem] flex flex-col max-h-[92vh] shadow-2xl animate-in slide-in-from-bottom duration-300">
            
            <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
              <h2 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] truncate pr-4">{editando.item_nome}</h2>
              <button type="button" onClick={() => setEditando(null)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={20}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-40">
              <div className="flex justify-center">
                <div className="relative h-32 w-32 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shadow-inner">
                  {editando.foto_url ? <img src={editando.foto_url} className="h-full w-full object-cover" /> : <Camera size={32} className="text-slate-200" />}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 active:opacity-100 transition-opacity cursor-pointer">
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUploadFoto} disabled={uploading} />
                    {uploading ? <Loader2 className="animate-spin text-white" size={32} /> : <Plus className="text-white" size={40} />}
                  </label>
                </div>
              </div>

              {/* STATUS SELECTOR - IMPORTANTE PARA A LOGICA DINAMICA */}
              <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl shadow-inner">
                {['Pendente', 'Comprado', 'Presente'].map(s => (
                  <button key={s} type="button" onClick={() => setEditando({...editando, status: s as any})} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${editando.status === s ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500'}`}>
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* CAMPOS CONDICIONAIS: ESCONDER SE FOR PRESENTE */}
              {editando.status !== 'Presente' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Marca</label>
                      <input className="w-full bg-slate-100 p-4 rounded-2xl text-base font-bold outline-none border-2 border-transparent focus:border-indigo-400" value={editando.marca || ''} onChange={e => setEditando({...editando, marca: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Preço (R$)</label>
                      <input type="number" step="0.01" className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black text-indigo-700 outline-none" value={editando.preco_pago || ''} onChange={e => setEditando({...editando, preco_pago: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Loja / Local</label>
                      <input className="w-full bg-slate-100 p-4 rounded-2xl text-base font-bold outline-none" value={editando.local_compra || ''} onChange={e => setEditando({...editando, local_compra: e.target.value})} />
                    </div>
                    <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl h-14 mt-auto">
                      {['Novo', 'Usado'].map(c => <button key={c} type="button" onClick={() => setEditando({...editando, condicao: c as any})} className={`flex-1 py-1 rounded-xl text-[10px] font-black transition-all ${editando.condicao === c ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-400'}`}>{c}</button>)}
                    </div>
                  </div>
                </div>
              )}

              {/* CAMPOS COMUNS */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Categoria</label>
                    <select className="w-full bg-slate-100 p-4 rounded-2xl text-sm font-black appearance-none outline-none" value={editando.categoria || 'Outros'} onChange={e => setEditando({...editando, categoria: e.target.value})}>
                      {categorias.filter(c => c !== 'Todas').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data</label>
                    <input type="date" className="w-full bg-slate-100 p-4 rounded-2xl text-sm font-bold outline-none" value={editando.data_compra || ''} onChange={e => setEditando({...editando, data_compra: e.target.value})} />
                  </div>
                </div>

                {editando.status === 'Presente' && (
                  <div className="space-y-1.5 animate-in zoom-in-95 duration-200">
                    <label className="text-[10px] font-black text-pink-600 uppercase ml-1">Quem presenteou o bebê?</label>
                    <input className="w-full bg-pink-50 p-4 rounded-2xl text-base font-bold text-pink-700 outline-none border-2 border-pink-100 placeholder:text-pink-300" placeholder="Ex: Titia Amanda" value={editando.quem_presenteou || ''} onChange={e => setEditando({...editando, quem_presenteou: e.target.value})} />
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-white border-t border-slate-100 shrink-0">
              <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl text-base shadow-xl active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={20} /> : "SALVAR ALTERAÇÕES"}
              </button>
            </div>
          </form>
        </div>
      )}

      {mostrarModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end justify-center p-0">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 pb-12">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-base font-black text-slate-900 uppercase">Novo Item</h2>
              <button onClick={() => setMostrarModal(false)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={20}/></button>
            </div>
            <div className="flex gap-3 mb-8">
              <input autoFocus className="flex-1 bg-slate-100 p-4 rounded-2xl outline-none text-base font-bold border-2 border-transparent focus:border-indigo-500 transition-all shadow-inner" placeholder="O que vamos comprar?" value={novoItemNome} onChange={e => setNovoItemNome(e.target.value)} />
              <button onClick={() => escutarVoz(setNovoItemNome)} className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl active:bg-indigo-100"><Mic size={24}/></button>
            </div>
            <button onClick={adicionarItem} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl text-base shadow-lg shadow-indigo-100 uppercase tracking-widest active:scale-95 transition-all">ADICIONAR</button>
          </div>
        </div>
      )}
    </div>
  );
}
