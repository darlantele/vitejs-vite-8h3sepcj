import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Mic, Camera, Search, Plus, Baby, ShoppingCart, X, Loader2, ChevronDown, Heart, Trash2
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
  const [fotoZoom, setFotoZoom] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ESTADO DO NOVO ITEM COMPLETO
  const [novoItem, setNovoItem] = useState({
    item_nome: '',
    categoria: 'Outros',
    marca: '',
    preco_pago: '',
    local_compra: '',
    data_compra: new Date().toISOString().split('T')[0],
    foto_url: '',
    status: 'Pendente'
  });

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

      if (isNovo) {
        setNovoItem({ ...novoItem, foto_url: publicUrl });
      } else if (editando) {
        setEditando({ ...editando, foto_url: publicUrl });
      }
    } catch (error: any) { alert(error.message); } finally { setUploading(false); }
  }

  async function adicionarAoEnxoval() {
    if (!novoItem.item_nome.trim()) {
      alert("Por favor, digite o nome do item.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('enxoval').insert([{
      item_nome: novoItem.item_nome,
      categoria: novoItem.categoria,
      marca: novoItem.marca,
      preco_pago: novoItem.preco_pago || 0,
      local_compra: novoItem.local_compra,
      data_compra: novoItem.data_compra,
      foto_url: novoItem.foto_url,
      status: novoItem.status,
      interesse: 'Ativo'
    }]);

    if (error) {
      alert("Erro ao adicionar: " + error.message);
    } else {
      setMostrarModal(false);
      setNovoItem({ item_nome: '', categoria: 'Outros', marca: '', preco_pago: '', local_compra: '', data_compra: new Date().toISOString().split('T')[0], foto_url: '', status: 'Pendente' });
      fetchEnxoval();
    }
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
      condicao: editando.status === 'Presente' ? 'Novo' : editando.condicao,
      status: editando.status,
      categoria: editando.categoria,
      quem_presenteou: editando.quem_presenteou,
      foto_url: editando.foto_url
    }).eq('id', editando.id);
    
    if (error) alert("Erro: " + error.message);
    else { setEditando(null); fetchEnxoval(); }
    setLoading(false);
  }

  async function excluirItem() {
    if (!editando) return;
    if (confirm(`Deseja realmente excluir "${editando.item_nome}"?`)) {
      const { error } = await supabase.from('enxoval').delete().eq('id', editando.id);
      if (!error) { setEditando(null); fetchEnxoval(); }
    }
  }

  const totalGasto = itens.filter(i => i.status === 'Comprado').reduce((acc, i) => acc + Number(i.preco_pago || 0), 0);

  const itensFiltrados = itens.filter(i => {
    const statusMatch = abaAtiva === 'Pendentes' ? i.status === 'Pendente' : (i.status === 'Comprado' || i.status === 'Presente');
    const catMatch = categoriaAtiva === 'Todas' || i.categoria === categoriaAtiva;
    return (statusMatch && catMatch && (i.item_nome ?? '').toLowerCase().includes(busca.toLowerCase()));
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 w-full flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 w-full shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h1 onClick={() => window.location.reload()} className="text-lg font-black text-indigo-600 leading-none cursor-pointer active:opacity-50 transition-opacity">
            Jurandir Baby 🍼
          </h1>
          <div className="flex items-center gap-2">
             <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                <button onClick={() => setAbaAtiva('Pendentes')} className={`px-2 py-1 rounded-md text-[9px] font-bold ${abaAtiva === 'Pendentes' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>FALTAM</button>
                <button onClick={() => setAbaAtiva('Comprados')} className={`px-2 py-1 rounded-md text-[9px] font-bold ${abaAtiva === 'Comprados' ? 'bg-white shadow-sm text-green-600' : 'text-slate-500'}`}>TEMOS</button>
             </div>
             <div className="bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
               <span className="text-[14px] font-black text-green-700 font-mono italic">R$ {totalGasto.toFixed(2)}</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-8 relative">
            <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-500" />
            <input className="w-full rounded-xl bg-slate-100 py-3 pl-9 pr-10 text-base outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
            {busca && <button onClick={() => setBusca('')} className="absolute right-3 top-3.5 text-slate-400"><X size={16}/></button>}
          </div>
          <div className="col-span-4 relative">
            <select value={categoriaAtiva} onChange={(e) => setCategoriaAtiva(e.target.value)} className="w-full bg-indigo-600 text-white text-[10px] font-bold py-4 px-2 rounded-xl appearance-none outline-none shadow-sm h-full uppercase">
              {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-4.5 h-3 w-3 text-white pointer-events-none" />
          </div>
        </div>
      </header>

      {/* LISTAGEM */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3 w-full pb-32">
        {itensFiltrados.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl p-4 shadow-md border border-slate-100 flex flex-col gap-2">
            <div className="flex gap-4">
              <div onClick={() => item.foto_url && setFotoZoom(item.foto_url)} className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 overflow-hidden shadow-inner cursor-zoom-in">
                {item.foto_url ? <img src={item.foto_url} className="h-full w-full object-cover" /> : <Camera size={24} className="text-slate-300" />}
              </div>
              <div onClick={() => setEditando(item)} className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{item.categoria}</span>
                  {item.condicao && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-black text-white uppercase bg-indigo-600 shadow-sm">{item.condicao}</span>}
                </div>
                <h3 className="font-bold text-slate-900 text-[16px] truncate leading-tight">{item.item_nome}</h3>
                <div className="mt-1">
                  {item.status === 'Presente' ? (
                    <span className="text-[11px] font-bold text-pink-600 flex items-center gap-1 uppercase tracking-tighter italic"><Heart size={10} fill="currentColor"/> {item.quem_presenteou || 'Alguém especial'}</span>
                  ) : (
                    <span className="text-[13px] font-black text-indigo-700">R$ {Number(item.preco_pago || 0).toFixed(2)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* ZOOM FOTO */}
      {fotoZoom && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6" onClick={() => setFotoZoom(null)}>
          <img src={fotoZoom} className="max-w-full max-h-[80vh] rounded-3xl shadow-2xl animate-in zoom-in-95 duration-300" />
        </div>
      )}

      {/* MODAL NOVO ITEM (RESTAURADO E COMPLETO) */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-start justify-center overflow-hidden">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center p-6 pt-10 border-b shrink-0">
              <h2 className="text-base font-black text-slate-900 uppercase">Novo Item</h2>
              <button onClick={() => setMostrarModal(false)} className="p-3 bg-slate-100 rounded-full"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-40">
              <div className="flex justify-center">
                <div className="relative h-32 w-32 rounded-[2rem] bg-slate-50 border-2 border-dashed flex items-center justify-center overflow-hidden shadow-inner">
                  {novoItem.foto_url ? <img src={novoItem.foto_url} className="h-full w-full object-cover" /> : <Camera size={32} className="text-slate-200" />}
                  <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/10 opacity-0 active:opacity-100">
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleUploadFoto(e, true)} />
                    <Plus className="text-white" size={40} />
                  </label>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome do Produto</label>
                  <input className="w-full bg-slate-100 p-4 rounded-2xl text-base font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all" placeholder="Ex: Berço" value={novoItem.item_nome} onChange={e => setNovoItem({...novoItem, item_nome: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Marca</label>
                    <input className="w-full bg-slate-100 p-4 rounded-2xl text-base font-bold outline-none" value={novoItem.marca} onChange={e => setNovoItem({...novoItem, marca: e.target.value})} />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Preço (R$)</label>
                    <input type="number" step="0.01" className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black text-indigo-700 outline-none" value={novoItem.preco_pago} onChange={e => setNovoItem({...novoItem, preco_pago: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Loja / Local</label>
                    <input className="w-full bg-slate-100 p-4 rounded-2xl text-base font-bold outline-none" value={novoItem.local_compra} onChange={e => setNovoItem({...novoItem, local_compra: e.target.value})} />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data</label>
                    <input type="date" className="w-full bg-slate-100 p-4 rounded-2xl text-base font-bold outline-none" value={novoItem.data_compra} onChange={e => setNovoItem({...novoItem, data_compra: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Categoria</label>
                  <select className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black appearance-none outline-none" value={novoItem.categoria} onChange={e => setNovoItem({...novoItem, categoria: e.target.value})}>
                    {categorias.filter(c => c !== 'Todas').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 bg-white border-t shrink-0 pb-12 shadow-inner">
              <button onClick={adicionarAoEnxoval} disabled={loading} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl text-base shadow-xl active:scale-95 transition-all uppercase tracking-widest">
                {loading ? <Loader2 className="animate-spin mx-auto" size={24} /> : "ADICIONAR AO ENXOVAL"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIÇÃO (NOME EDITÁVEL E EXCLUSÃO) */}
      {editando && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-start justify-center overflow-hidden">
          <form onSubmit={salvarEdicao} className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center p-6 pt-10 border-b shrink-0">
              <input className="text-sm font-black text-indigo-600 uppercase tracking-widest bg-transparent outline-none focus:ring-1 focus:ring-indigo-100 rounded pr-4 w-full" value={editando.item_nome} onChange={e => setEditando({...editando, item_nome: e.target.value})} />
              <button type="button" onClick={() => setEditando(null)} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={24}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-40">
              <div className="flex flex-col items-center gap-4">
                <div className="relative h-36 w-36 rounded-[2.5rem] bg-slate-50 border-2 border-dashed flex items-center justify-center overflow-hidden shadow-inner group">
                  {editando.foto_url ? <img src={editando.foto_url} className="h-full w-full object-cover" /> : <Camera size={36} className="text-slate-200" />}
                  <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/20 opacity-0 active:opacity-100 transition-opacity">
                    <input type="file" accept="image/*" capture="environment" className="hidden" onDoubleClick={(e) => e.stopPropagation()} onChange={handleUploadFoto} />
                    <Plus className="text-white" size={48} />
                  </label>
                </div>
                {editando.foto_url && (
                  <button type="button" onClick={() => setEditando({...editando, foto_url: null})} className="text-red-500 font-bold text-xs uppercase tracking-tighter bg-red-50 px-4 py-2 rounded-full"><Trash2 size={12} className="inline mr-1"/> Excluir Foto</button>
                )}
              </div>

              <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl shadow-inner">
                {['Pendente', 'Comprado', 'Presente'].map(s => (
                  <button key={s} type="button" onClick={() => setEditando({...editando, status: s as any})} className={`flex-1 py-4 rounded-xl text-[10px] font-black transition-all ${editando.status === s ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500'}`}>{s.toUpperCase()}</button>
                ))}
              </div>

              <div className="space-y-6">
                {editando.status !== 'Presente' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-left"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Marca</label><input className="w-full bg-slate-100 p-4 rounded-2xl text-base font-bold outline-none" value={editando.marca || ''} onChange={e => setEditando({...editando, marca: e.target.value})} /></div>
                    <div className="space-y-1.5 text-left"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Preço (R$)</label><input type="number" step="0.01" className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black text-indigo-700 outline-none" value={editando.preco_pago || ''} onChange={e => setEditando({...editando, preco_pago: e.target.value})} /></div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Categoria</label><select className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black appearance-none outline-none" value={editando.categoria || 'Outros'} onChange={e => setEditando({...editando, categoria: e.target.value})}>{categorias.filter(c => c !== 'Todas').map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div className="space-y-1.5 text-left"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data</label><input type="date" className="w-full bg-slate-100 p-4 rounded-2xl text-base font-bold outline-none" value={editando.data_compra || ''} onChange={e => setEditando({...editando, data_compra: e.target.value})} /></div>
                </div>
                {editando.status === 'Presente' && (
                  <div className="space-y-1.5 text-left animate-in zoom-in-95"><label className="text-[10px] font-black text-pink-600 uppercase ml-1 tracking-widest">Quem presenteou?</label><input className="w-full bg-pink-50 p-5 rounded-2xl text-base font-bold text-pink-700 outline-none border-2 border-pink-100 placeholder:text-pink-300" placeholder="Ex: Titia Amanda" value={editando.quem_presenteou || ''} onChange={e => setEditando({...editando, quem_presenteou: e.target.value})} /></div>
                )}
              </div>
            </div>

            <div className="p-6 bg-white border-t shrink-0 pb-12 flex gap-4">
              <button type="button" onClick={excluirItem} className="bg-red-50 text-red-500 p-5 rounded-2xl active:bg-red-100"><Trash2 size={24}/></button>
              <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 text-white font-black py-5 rounded-2xl text-base shadow-xl active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={24} /> : "SALVAR ALTERAÇÕES"}
              </button>
            </div>
          </form>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-10 py-4 pb-12 flex justify-around items-center z-30 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
        <ShoppingCart size={24} className="text-indigo-600" />
        <button onClick={() => setMostrarModal(true)} className="bg-indigo-600 p-4 rounded-full text-white shadow-xl -mt-16 border-4 border-slate-50 active:scale-90 transition-all"><Plus size={28}/></button>
        <Baby size={24} className="text-slate-300" />
      </nav>
    </div>
  );
}
