import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Camera, Search, Plus, Baby, ShoppingCart, X, Loader2, Heart, Trash2, Package, BarChart3
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export default function App() {
  const [itens, setItens] = useState<any[]>([]);
  const [listaCategorias, setListaCategorias] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<'Pendentes' | 'Comprados'>('Pendentes');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarResumo, setMostrarResumo] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [fotoZoom, setFotoZoom] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tamanhos = ["N/A", "RN", "0-3m", "3-6m", "6-9m", "9-12m", "P", "M", "G", "GG", "+3m", "+6m", "+9m", "+12m", "+18m", "+2a", "+3a"];

  const [novoItem, setNovoItem] = useState({
    item_nome: '',
    categoria_id: '',
    tamanho_especificacao: 'N/A',
    marca: '',
    preco_pago: '',
    qtd_pacotes: 1,
    unidades_por_pacote: 1,
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

  const ehFralda = (catId: string, nomeItem: string) => {
    const nomeCat = listaCategorias.find(c => c.id === catId)?.nome.toLowerCase() || "";
    return nomeCat.includes("fralda") || nomeItem.toLowerCase().includes("fralda");
  };

  async function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>, isNovo: boolean = false) {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const fileName = `foto-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('fotos-enxoval').upload(fileName, file);
    if (!error) {
      const { data } = supabase.storage.from('fotos-enxoval').getPublicUrl(fileName);
      if (isNovo) setNovoItem({ ...novoItem, foto_url: data.publicUrl });
      else if (editando) setEditando({ ...editando, foto_url: data.publicUrl });
    }
  }

  async function adicionarAoEnxoval() {
    if (!novoItem.item_nome.trim()) return;
    setLoading(true);
    const precoCalculado = ehFralda(novoItem.categoria_id, novoItem.item_nome) 
      ? Number(novoItem.preco_pago) * novoItem.qtd_pacotes 
      : Number(novoItem.preco_pago);

    const { error } = await supabase.from('enxoval').insert([{
      item_nome: novoItem.item_nome,
      categoria_id: novoItem.categoria_id,
      tamanho_especificacao: novoItem.tamanho_especificacao,
      marca: novoItem.marca,
      preco_pago: precoCalculado,
      qtd_pacotes: novoItem.qtd_pacotes,
      unidades_por_pacote: novoItem.unidades_por_pacote,
      data_compra: novoItem.data_compra,
      foto_url: novoItem.foto_url,
      status: novoItem.status,
      interesse: 'Ativo'
    }]);

    if (!error) {
      setMostrarModal(false);
      setNovoItem({ ...novoItem, item_nome: '', foto_url: '', preco_pago: '', qtd_pacotes: 1 });
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
      tamanho_especificacao: editando.tamanho_especificacao,
      marca: editando.status === 'Presente' ? null : editando.marca,
      preco_pago: editando.preco_pago,
      qtd_pacotes: editando.qtd_pacotes,
      unidades_por_pacote: editando.unidades_por_pacote,
      status: editando.status,
      categoria_id: editando.categoria_id,
      quem_presenteou: editando.quem_presenteou,
      foto_url: editando.foto_url
    }).eq('id', editando.id);
    if (!error) { setEditando(null); fetchEnxoval(); }
    setLoading(false);
  }

  async function excluirItem() {
    if (!editando || !confirm(`Excluir "${editando.item_nome}"?`)) return;
    setLoading(true);
    const { error } = await supabase.from('enxoval').delete().eq('id', editando.id);
    if (!error) { setEditando(null); fetchEnxoval(); }
    setLoading(false);
  }

  const totalGasto = itens.filter(i => i.status === 'Comprado').reduce((acc, i) => acc + Number(i.preco_pago || 0), 0);

  const itensFiltrados = itens.filter(i => {
    const statusMatch = abaAtiva === 'Pendentes' ? i.status === 'Pendente' : (i.status === 'Comprado' || i.status === 'Presente');
    const catMatch = categoriaFiltro === 'Todas' || i.categorias?.nome === categoriaFiltro;
    return (statusMatch && catMatch && i.item_nome.toLowerCase().includes(busca.toLowerCase()));
  });

  const resumoTamanhos = tamanhos.filter(t => t !== 'N/A').map(t => ({
    tamanho: t,
    qtd: itens.filter(i => i.tamanho_especificacao === t && (i.status === 'Comprado' || i.status === 'Presente')).length
  })).filter(r => r.qtd > 0);

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-900 w-full flex flex-col overflow-x-hidden">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 w-full shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h1 onClick={() => window.location.reload()} className="text-[17px] font-black text-indigo-700 flex flex-col items-start leading-none tracking-tight">
            <span>Jurandir Baby</span>
            <div className="flex gap-1 mt-1 text-sm"><span>🍼</span><span>👶</span><span>🚗</span></div>
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
            <input className="w-full rounded-xl bg-slate-100 py-3.5 pl-9 pr-10 text-base font-black outline-none border-2 border-transparent focus:border-indigo-500" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <div className="col-span-4 relative">
            <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className="w-full bg-indigo-700 text-white text-[10px] font-black py-4 px-0 indent-0 text-center appearance-none outline-none shadow-md h-full rounded-xl uppercase m-0 border-none">
              <option value="Todas">TODAS</option>
              {listaCategorias.map(cat => <option key={cat.id} value={cat.nome}>{cat.nome.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
        
        {abaAtiva === 'Comprados' && (
          <button onClick={() => setMostrarResumo(true)} className="mt-2 w-full bg-slate-100 text-[10px] font-black py-2 rounded-lg text-indigo-700 flex items-center justify-center gap-2 border border-slate-200 active:bg-slate-200">
            <BarChart3 size={12}/> VER RESUMO POR TAMANHO
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-3 space-y-3 pb-32">
        {itensFiltrados.map((item) => (
          <div key={item.id} onClick={() => setEditando(item)} className="bg-white rounded-2xl p-4 shadow-md border border-slate-200 flex flex-col gap-2 active:bg-slate-50">
            <div className="flex gap-4">
              <div onClick={(e) => { e.stopPropagation(); item.foto_url && setFotoZoom(item.foto_url); }} className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden shadow-inner">
                {item.foto_url ? <img src={item.foto_url} className="h-full w-full object-cover" /> : <Camera size={24} className="text-slate-400" />}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex gap-1 items-center">
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">{item.categorias?.nome}</span>
                    {item.tamanho_especificacao !== 'N/A' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white text-indigo-700 font-bold border-2 border-indigo-600 shadow-sm">{item.tamanho_especificacao}</span>
                    )}
                  </div>
                  {item.unidades_por_pacote > 1 && (
                    <span className="text-[9px] text-slate-400 flex items-center gap-0.5"><Package size={10}/> {item.qtd_pacotes * item.unidades_por_pacote} un</span>
                  )}
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

      {mostrarResumo && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setMostrarResumo(false)}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-black text-indigo-700 uppercase">Resumo do Enxoval</h2>
              <button onClick={() => setMostrarResumo(false)}><X size={20}/></button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2">
              {resumoTamanhos.map(r => (
                <div key={r.tamanho} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                  <span className="font-black text-slate-600">{r.tamanho}</span>
                  <span className="bg-indigo-700 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold">{r.qtd} un</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {fotoZoom && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6" onClick={() => setFotoZoom(null)}>
          <img src={fotoZoom} className="max-w-full max-h-[85vh] rounded-3xl shadow-2xl" alt="Zoom" />
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-10 py-4 pb-12 flex justify-around items-center z-30 shadow-lg">
        <ShoppingCart size={24} className="text-indigo-700" />
        <button onClick={() => setMostrarModal(true)} className="bg-indigo-700 p-4 rounded-full text-white shadow-xl -mt-16 border-4 border-slate-50 active:scale-90 transition-all"><Plus size={28}/></button>
        <Baby size={24} className="text-slate-400" />
      </nav>

      {/* FORMULÁRIO NOVO ITEM */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end justify-center overflow-hidden">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] flex flex-col max-h-[90vh] shadow-2xl p-6 pb-12 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base font-black text-slate-900 uppercase">Novo Item</h2>
              <button onClick={() => setMostrarModal(false)} className="p-2 bg-slate-100 rounded-full"><X size={24}/></button>
            </div>
            <div className="space-y-4 overflow-y-auto">
              <input className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black outline-none border-2 border-transparent focus:border-indigo-500" placeholder="Nome do Item" value={novoItem.item_nome} onChange={e => setNovoItem({...novoItem, item_nome: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <select className="bg-slate-100 p-4 rounded-2xl text-[12px] font-black" value={novoItem.categoria_id} onChange={e => setNovoItem({...novoItem, categoria_id: e.target.value})}>
                  {listaCategorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <select className="bg-slate-100 p-4 rounded-2xl text-base font-black" value={novoItem.tamanho_especificacao} onChange={e => setNovoItem({...novoItem, tamanho_especificacao: e.target.value})}>
                  {tamanhos.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {ehFralda(novoItem.categoria_id, novoItem.item_nome) && (
                <div className="grid grid-cols-2 gap-2 animate-in zoom-in-95">
                  <input type="number" className="bg-indigo-50 p-4 rounded-2xl text-base font-black border-2 border-indigo-200" placeholder="Pacotes" value={novoItem.qtd_pacotes} onChange={e => setNovoItem({...novoItem, qtd_pacotes: Number(e.target.value)})} />
                  <input type="number" className="bg-indigo-50 p-4 rounded-2xl text-base font-black border-2 border-indigo-200" placeholder="Unid/Pac" value={novoItem.unidades_por_pacote} onChange={e => setNovoItem({...novoItem, unidades_por_pacote: Number(e.target.value)})} />
                </div>
              )}
              <input type="number" step="0.01" className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black" placeholder="Preço" value={novoItem.preco_pago} onChange={e => setNovoItem({...novoItem, preco_pago: e.target.value})} />
              <input type="file" accept="image/*" onChange={(e) => handleUploadFoto(e, true)} className="text-[10px] font-black" />
              <button onClick={adicionarAoEnxoval} disabled={loading} className="w-full bg-indigo-700 text-white font-black py-5 rounded-2xl text-base shadow-xl active:scale-95">
                {loading ? <Loader2 className="animate-spin mx-auto" size={24} /> : "ADICIONAR AO ENXOVAL"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORMULÁRIO DE EDIÇÃO */}
      {editando && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end justify-center overflow-hidden">
          <form onSubmit={salvarEdicao} className="bg-white w-full max-w-md rounded-t-[2.5rem] flex flex-col max-h-[90vh] shadow-2xl p-6 pb-12 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <input className="text-base font-black text-indigo-700 uppercase bg-transparent outline-none w-full" value={editando.item_nome} onChange={e => setEditando({...editando, item_nome: e.target.value})} />
              <button type="button" onClick={() => setEditando(null)}><X size={24}/></button>
            </div>
            <div className="space-y-4 overflow-y-auto">
              <div className="flex flex-col items-center gap-2">
                 <div className="h-24 w-24 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300">
                   {editando.foto_url ? <img src={editando.foto_url} className="h-full w-full object-cover" alt="Foto" /> : <Camera className="text-slate-300" />}
                 </div>
                 <input type="file" accept="image/*" onChange={(e) => handleUploadFoto(e)} className="text-[10px]" />
              </div>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                {['Pendente', 'Comprado', 'Presente'].map(s => (
                  <button key={s} type="button" onClick={() => setEditando({...editando, status: s})} className={`flex-1 py-3 rounded-lg text-[10px] font-black ${editando.status === s ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500'}`}>{s.toUpperCase()}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className="bg-slate-100 p-4 rounded-2xl text-[12px] font-black" value={editando.categoria_id} onChange={e => setEditando({...editando, categoria_id: e.target.value})}>
                  {listaCategorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <select className="bg-slate-100 p-4 rounded-2xl text-base font-black" value={editando.tamanho_especificacao} onChange={e => setEditando({...editando, tamanho_especificacao: e.target.value})}>
                  {tamanhos.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {editando.status !== 'Presente' && (
                <div className="grid grid-cols-2 gap-2">
                   <input className="bg-slate-100 p-4 rounded-2xl text-base font-black" placeholder="Marca" value={editando.marca || ''} onChange={e => setEditando({...editando, marca: e.target.value})} />
                   <input type="number" step="0.01" className="bg-slate-100 p-4 rounded-2xl text-base font-black" placeholder="Preço" value={editando.preco_pago || ''} onChange={e => setEditando({...editando, preco_pago: e.target.value})} />
                </div>
              )}
              {editando.status === 'Presente' && (
                <input className="w-full bg-pink-50 p-4 rounded-2xl text-base font-black text-pink-900 border-2 border-pink-200" placeholder="Quem presenteou?" value={editando.quem_presenteou || ''} onChange={e => setEditando({...editando, quem_presenteou: e.target.value})} />
              )}
              <div className="flex gap-4 pt-4">
                 <button type="button" onClick={excluirItem} className="bg-red-50 text-red-600 p-5 rounded-2xl"><Trash2 size={24}/></button>
                 <button type="submit" className="flex-1 bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl">SALVAR ALTERAÇÕES</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
