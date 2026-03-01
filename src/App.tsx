import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Mic, Camera, Search, Plus, Baby, ShoppingCart, X, Loader2, Heart, Trash2
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function App() {
  const [itens, setItens] = useState<any[]>([]);
  const [listaCategorias, setListaCategorias] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<'Pendentes' | 'Comprados'>('Pendentes');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [fotoZoom, setFotoZoom] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [novoItem, setNovoItem] = useState({
    item_nome: '',
    categoria_id: '',
    marca: '',
    preco_pago: '',
    local_compra: '',
    data_compra: new Date().toISOString().split('T')[0],
    foto_url: '',
    status: 'Pendente'
  });

  useEffect(() => { 
    fetchCategorias();
    fetchEnxoval(); 
  }, []);

  async function fetchCategorias() {
    const { data } = await supabase.from('categorias').select('*').order('nome');
    if (data) {
      setListaCategorias(data);
      if (data.length > 0) setNovoItem(prev => ({ ...prev, categoria_id: data[0].id }));
    }
  }

  async function fetchEnxoval() {
    setLoading(true);
    const { data } = await supabase
      .from('enxoval')
      .select(`*, categorias(nome)`)
      .eq('interesse', 'Ativo')
      .order('item_nome');
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

  async function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>, isNovo: boolean = false) {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      setUploading(true);
      const arquivoOriginal = e.target.files[0];
      const fotoComprimida = await comprimirImagem(arquivoOriginal);
      const fileName = `foto-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('fotos-enxoval').upload(fileName, fotoComprimida);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('fotos-enxoval').getPublicUrl(fileName);
      if (isNovo) setNovoItem({ ...novoItem, foto_url: publicUrl });
      else if (editando) setEditando({ ...editando, foto_url: publicUrl });
    } catch (error: any) { alert(error.message); } finally { setUploading(false); }
  }

  async function adicionarAoEnxoval() {
    if (!novoItem.item_nome.trim()) return;
    setLoading(true);
    const { error } = await supabase.from('enxoval').insert([{
      item_nome: novoItem.item_nome,
      categoria_id: novoItem.categoria_id,
      marca: novoItem.marca,
      preco_pago: novoItem.preco_pago || 0,
      local_compra: novoItem.local_compra,
      data_compra: novoItem.data_compra,
      foto_url: novoItem.foto_url,
      status: novoItem.status,
      interesse: 'Ativo'
    }]);
    if (!error) {
      setMostrarModal(false);
      setNovoItem({ ...novoItem, item_nome: '', foto_url: '' });
      fetchEnxoval();
    } else alert(error.message);
    setLoading(false);
  }

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setLoading(true);
    const { error } = await supabase.from('enxoval').update({
      item_nome: editando.item_nome,
      marca: editando.status === 'Presente' ? null : editando.marca,
      preco_pago: editando.status === 'Presente' ? 0 : editando.preco_pago,
      local_compra: editando.status === 'Presente' ? null : editando.local_compra,
      data_compra: editando.data_compra,
      status: editando.status,
      categoria_id: editando.categoria_id,
      quem_presenteou: editando.quem_presenteou,
      foto_url: editando.foto_url
    }).eq('id', editando.id);
    if (!error) { setEditando(null); fetchEnxoval(); } else alert(error.message);
    setLoading(false);
  }

  async function excluirItem() {
    if (!editando || !confirm(`Excluir "${editando.item_nome}"?`)) return;
    const { error } = await supabase.from('enxoval').delete().eq('id', editando.id);
    if (!error) { setEditando(null); fetchEnxoval(); }
  }

  const totalGasto = itens.filter(i => i.status === 'Comprado').reduce((acc, i) => acc + Number(i.preco_pago || 0), 0);

  const escutarVoz = (callback: (texto: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.onresult = (event: any) => { callback(event.results[0][0].transcript); recognition.stop(); };
    recognition.start();
  };

  const itensFiltrados = itens.filter(i => {
    const statusMatch = abaAtiva === 'Pendentes' ? i.status === 'Pendente' : (i.status === 'Comprado' || i.status === 'Presente');
    const catMatch = categoriaFiltro === 'Todas' || i.categorias?.nome === categoriaFiltro;
    return (statusMatch && catMatch && (i.item_nome ?? '').toLowerCase().includes(busca.toLowerCase()));
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-900 w-full flex flex-col overflow-x-hidden">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 w-full shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h1 onClick={() => window.location.reload()} className="text-[17px] font-black text-indigo-700 cursor-pointer select-none active:opacity-50 transition-opacity tracking-tight">
            Jurandir Baby   🍼👶🧸
          </h1>
          <div className="flex items-center gap-2">
             <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                <button onClick={() => setAbaAtiva('Pendentes')} className={`px-2 py-1 rounded-md text-[9px] font-bold ${abaAtiva === 'Pendentes' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500'}`}>FALTAM</button>
                <button onClick={() => setAbaAtiva('Comprados')} className={`px-2 py-1 rounded-md text-[9px] font-bold ${abaAtiva === 'Comprados' ? 'bg-white shadow-sm text-green-700' : 'text-slate-500'}`}>TEMOS</button>
             </div>
             <div className="bg-green-100 px-3 py-1.5 rounded-lg border border-green-300 shadow-sm">
               <span className="text-[14px] font-black text-green-800 font-mono italic">R$ {totalGasto.toFixed(2)}</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-8 relative">
            <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-600" />
            <input className="w-full rounded-xl bg-slate-100 py-3.5 pl-9 pr-10 text-base font-black outline-none border-2 border-transparent focus:border-indigo-500 placeholder:font-normal" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
            {busca && <button onClick={() => setBusca('')} className="absolute right-3 top-3.5 text-slate-500"><X size={16}/></button>}
          </div>
          <div className="col-span-4 relative">
            <select 
              value={categoriaFiltro} 
              onChange={(e) => setCategoriaFiltro(e.target.value)} 
              className="w-full bg-indigo-700 text-white text-[10px] font-black py-4 px-0 indent-0 text-center rounded-xl appearance-none outline-none shadow-md h-full uppercase"
            >
              <option value="Todas">TODAS</option>
              {listaCategorias.map(cat => <option key={cat.id} value={cat.nome}>{cat.nome.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-3 space-y-3 w-full pb-32">
        {itensFiltrados.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl p-4 shadow-md border border-slate-200 flex flex-col gap-2">
            <div className="flex gap-4">
              <div onClick={() => item.foto_url && setFotoZoom(item.foto_url)} className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden shadow-inner cursor-zoom-in transition-transform active:scale-95">
                {item.foto_url ? <img src={item.foto_url} className="h-full w-full object-cover" /> : <Camera size={24} className="text-slate-400" />}
              </div>
              <div onClick={() => setEditando(item)} className="flex-1 min-w-0 text-left">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">{item.categorias?.nome || 'Outros'}</span>
                  {item.condicao && <span className="text-[8px] px-2 py-0.5 rounded-full font-black text-white uppercase bg-indigo-700 shadow-sm">{item.condicao}</span>}
                </div>
                <h3 className="font-black text-black text-[17px] truncate leading-tight tracking-tight">{item.item_nome}</h3>
                <div className="mt-1">
                  {item.status === 'Presente' ? (
                    <span className="text-[12px] font-black text-pink-700 flex items-center gap-1 uppercase italic tracking-tighter"><Heart size={10} fill="currentColor"/> {item.quem_presenteou || 'Alguém especial'}</span>
                  ) : (
                    <span className="text-[14px] font-black text-indigo-900">R$ {Number(item.preco_pago || 0).toFixed(2)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>

      {fotoZoom && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 animate-in fade-in" onClick={() => setFotoZoom(null)}>
          <img src={fotoZoom} className="max-w-full max-h-[85vh] rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300" />
        </div>
      )}

      {mostrarModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end justify-center overflow-hidden">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] flex flex-col max-h-[90vh] shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center p-6 border-b shrink-0">
              <h2 className="text-base font-black text-slate-900 uppercase">Novo Item</h2>
              <button onClick={() => setMostrarModal(false)} className="p-3 bg-slate-100 rounded-full active:bg-slate-200"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-40">
              <div className="flex justify-center">
                <div className="relative h-32 w-32 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shadow-inner">
                  {novoItem.foto_url ? <img src={novoItem.foto_url} className="h-full w-full object-cover" /> : <Camera size={32} className="text-slate-300" />}
                  <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/10 opacity-0 active:opacity-100 transition-opacity">
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleUploadFoto(e, true)} />
                    {uploading ? <Loader2 className="animate-spin text-white" size={32} /> : <Plus className="text-white" size={40} />}
                  </label>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Nome do Produto</label>
                  <div className="flex gap-2">
                    <input className="flex-1 bg-slate-100 p-4 rounded-2xl text-base font-black outline-none border-2 border-transparent focus:border-indigo-500" value={novoItem.item_nome} onChange={e => setNovoItem({...novoItem, item_nome: e.target.value})} />
                    <button onClick={() => escutarVoz((t) => setNovoItem({...novoItem, item_nome: t}))} className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl active:bg-indigo-100"><Mic size={24}/></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Marca</label><input className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black outline-none border-2 border-transparent focus:border-indigo-500" value={novoItem.marca} onChange={e => setNovoItem({...novoItem, marca: e.target.value})} /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Preço (R$)</label><input type="number" step="0.01" className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black text-indigo-900 outline-none border-2 border-transparent focus:border-indigo-500" value={novoItem.preco_pago} onChange={e => setNovoItem({...novoItem, preco_pago: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Loja / Local</label><input className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black outline-none border-2 border-transparent focus:border-indigo-500" value={novoItem.local_compra} onChange={e => setNovoItem({...novoItem, local_compra: e.target.value})} /></div>
                  <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Data</label><input type="date" className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black outline-none border-2 border-transparent focus:border-indigo-500" value={novoItem.data_compra} onChange={e => setNovoItem({...novoItem, data_compra: e.target.value})} /></div>
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Categoria</label>
                  <select className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black appearance-none outline-none shadow-sm border-2 border-transparent focus:border-indigo-500" value={novoItem.categoria_id} onChange={e => setNovoItem({...novoItem, categoria_id: e.target.value})}>
                    {listaCategorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 bg-white border-t shrink-0 pb-12 shadow-inner text-center">
              <button onClick={adicionarAoEnxoval} disabled={loading} className="w-full bg-indigo-700 text-white font-black py-5 rounded-2xl text-base shadow-xl active:scale-95 transition-all uppercase tracking-widest">
                {loading ? <Loader2 className="animate-spin mx-auto" size={24} /> : "ADICIONAR AO ENXOVAL"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end justify-center overflow-hidden">
          <form onSubmit={salvarEdicao} className="bg-white w-full max-w-md rounded-t-[2.5rem] flex flex-col max-h-[90vh] shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center p-6 border-b shrink-0">
              <input className="text-base font-black text-indigo-700 uppercase tracking-widest bg-transparent outline-none w-full pr-4" value={editando.item_nome} onChange={e => setEditando({...editando, item_nome: e.target.value})} />
              <button type="button" onClick={() => setEditando(null)} className="p-3 bg-slate-100 rounded-full active:bg-slate-200"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-40 text-left">
              <div className="flex flex-col items-center gap-4">
                <div className="relative h-36 w-36 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shadow-inner group">
                  {editando.foto_url ? <img src={editando.foto_url} className="h-full w-full object-cover" /> : <Camera size={36} className="text-slate-300" />}
                  <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/20 opacity-0 active:opacity-100 transition-opacity">
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUploadFoto} />
                    {uploading ? <Loader2 className="animate-spin text-white" size={32} /> : <Plus className="text-white" size={48} />}
                  </label>
                </div>
                {editando.foto_url && <button type="button" onClick={() => setEditando({...editando, foto_url: null})} className="text-red-600 font-black text-xs uppercase bg-red-50 px-4 py-2 rounded-full border border-red-100"><Trash2 size={12} className="inline mr-1"/> Excluir Foto</button>}
              </div>
              <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl shadow-inner border border-slate-200">
                {['Pendente', 'Comprado', 'Presente'].map(s => (
                  <button key={s} type="button" onClick={() => setEditando({...editando, status: s as any})} className={`flex-1 py-4 rounded-xl text-[10px] font-black transition-all ${editando.status === s ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500'}`}>{s.toUpperCase()}</button>
                ))}
              </div>
              <div className="space-y-6">
                {editando.status !== 'Presente' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Marca</label><input className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black outline-none border-2 border-transparent focus:border-indigo-500 shadow-sm" value={editando.marca || ''} onChange={e => setEditando({...editando, marca: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Preço (R$)</label><input type="number" step="0.01" className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black text-indigo-900 outline-none border-2 border-transparent focus:border-indigo-500 shadow-sm" value={editando.preco_pago || ''} onChange={e => setEditando({...editando, preco_pago: e.target.value})} /></div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Categoria</label>
                    <select className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black appearance-none outline-none shadow-sm border-2 border-transparent focus:border-indigo-500" value={editando.categoria_id} onChange={e => setEditando({...editando, categoria_id: e.target.value})}>
                      {listaCategorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Data</label>
                    <input type="date" className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black outline-none shadow-sm border-2 border-transparent focus:border-indigo-500" value={editando.data_compra || ''} onChange={e => setEditando({...editando, data_compra: e.target.value})} />
                  </div>
                </div>
                {editando.status === 'Presente' && (
                  <div className="space-y-1.5 text-left animate-in zoom-in-95 duration-200">
                    <label className="text-[10px] font-black text-pink-700 uppercase ml-1 tracking-widest">Quem presenteou o Juras?</label>
                    <input className="w-full bg-pink-50 p-5 rounded-2xl text-base font-black text-pink-900 outline-none border-2 border-pink-200 placeholder:text-pink-300 shadow-sm" placeholder="Ex: Titia Amanda" value={editando.quem_presenteou || ''} onChange={e => setEditando({...editando, quem_presenteou: e.target.value})} />
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 bg-white border-t shrink-0 pb-12 flex gap-4">
              <button type="button" onClick={excluirItem} className="bg-red-50 text-red-600 p-5 rounded-2xl active:bg-red-100 border border-red-100"><Trash2 size={24}/></button>
              <button type="submit" disabled={loading} className="flex-1 bg-indigo-700 text-white font-black py-5 rounded-2xl text-base shadow-xl active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-2">{loading ? <Loader2 className="animate-spin" size={24} /> : "SALVAR ALTERAÇÕES"}</button>
            </div>
          </form>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-10 py-4 pb-12 flex justify-around items-center z-30 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
        <ShoppingCart size={24} className="text-indigo-700" />
        <button onClick={() => setMostrarModal(true)} className="bg-indigo-700 p-4 rounded-full text-white shadow-xl -mt-16 border-4 border-slate-50 active:scale-90 transition-all"><Plus size={28}/></button>
        <Baby size={24} className="text-slate-400" />
      </nav>
    </div>
  );
}
