import { motion } from "framer-motion";
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Camera, Search, Plus, Baby, ShoppingCart, X, Loader2, Trash2, 
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
  const [tipoResumo, setTipoResumo] = useState<'geral' | 'fraldas'>('geral');
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

  const ehFralda = (catId: string) => {
    const nomeCat = listaCategorias.find(c => c.id === catId)?.nome.toLowerCase() || "";
    return nomeCat === "fraldas" || nomeCat === "fralda";
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
    
    // Lógica Jurandir: Multiplica o preço se for fralda e estiver comprando vários pacotes
    const precoFinal = ehFralda(novoItem.categoria_id) 
      ? Number(novoItem.preco_pago) * novoItem.qtd_pacotes 
      : Number(novoItem.preco_pago);

    const { error } = await supabase.from('enxoval').insert([{
      ...novoItem,
      preco_pago: precoFinal,
      interesse: 'Ativo'
    }]);

    if (!error) {
      setMostrarModal(false);
      setNovoItem({ ...novoItem, item_nome: '', foto_url: '', preco_pago: '', qtd_pacotes: 1, unidades_por_pacote: 1 });
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
    qtd: itens
      .filter(i => i.tamanho_especificacao === t && (i.status === 'Comprado' || i.status === 'Presente'))
      .reduce((acc, curr) => acc + (Number(curr.unidades_por_pacote || 1) * Number(curr.qtd_pacotes || 1)), 0)
  })).filter(r => r.qtd > 0);


// 👶 NOVO RESUMO APENAS PARA FRALDAS
const resumoFraldas = tamanhos
  .filter(t => t !== 'N/A')
  .map(t => ({
    tamanho: t,
    qtd: itens
      .filter(i =>
        i.tipo_fralda && i.tipo_fralda !== 'Não se aplica' &&
        i.tamanho_especificacao === t &&
        (i.status === 'Comprado' || i.status === 'Presente')
      )
      .reduce(
        (acc, curr) =>
          acc +
          Number(curr.qtd_pacotes || 1) *
          Number(curr.unidades_por_pacote || 1),
        0
      )
  }))
  .filter(r => r.qtd > 0);

// ⭐ SELETOR DO RESUMO
const dadosResumo = tipoResumo === 'fraldas'
  ? resumoFraldas
  : resumoTamanhos;  

  if (!itens.length) {
  return (
    <main className="p-4 grid grid-cols-2 gap-3">
      {[1,2,3,4,5,6].map((i) => (
        <div
          key={i}
          className="bg-slate-200 animate-pulse rounded-2xl h-28"
        />
      ))}
    </main>
  );
}

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-900 w-full flex flex-col overflow-x-hidden">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 w-full shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h1 onClick={() => window.location.reload()} className="text-[17px] font-black text-indigo-700 flex flex-col leading-none">
            Jurandir Baby
            <div className="flex gap-1 mt-1 text-sm"><span>🍼</span><span>👶</span><span>🚗</span></div>
          </h1>
          <div className="flex items-center gap-2">
             <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                <button onClick={() => setAbaAtiva('Pendentes')} className={`px-2 py-1 rounded-md text-[9px] font-bold ${abaAtiva === 'Pendentes' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500'}`}>FALTAM</button>
                <button onClick={() => setAbaAtiva('Comprados')} className={`px-2 py-1 rounded-md text-[9px] font-bold ${abaAtiva === 'Comprados' ? 'bg-white shadow-sm text-green-700' : 'text-slate-500'}`}>TEMOS</button>
             </div>
             <div className="bg-green-100 px-3 py-1.5 rounded-lg border border-green-300">
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
            <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className="w-full bg-indigo-700 text-white text-[10px] font-black py-4 rounded-xl uppercase appearance-none text-center outline-none">
              <option value="Todas">  CATEGORIAS</option>
              {listaCategorias.map(cat => <option key={cat.id} value={cat.nome}>{cat.nome.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
        {abaAtiva === 'Comprados' && (
          <button onClick={() => setMostrarResumo(true)} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"> 📊 RESUMO POR TAMANHO
          </button>
        )}
      </header>

       <main className="flex-1 p-3 grid grid-cols-2 gap-3 pb-32">
        {itensFiltrados.map((item) => (
         <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25 }}
    whileTap={{ scale: 0.96 }}
    whileHover={{ scale: 1.02 }}
    onClick={() => setEditando(item)}
    className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden active:scale-[0.97] transition"
>

  <div
    onClick={(e) => {
      e.stopPropagation();
      item.foto_url && setFotoZoom(item.foto_url);
    }}
    className="w-full h-28 bg-slate-100 flex items-center justify-center overflow-hidden"
  >
    {item.foto_url ? (
      <img
        src={item.foto_url}
        className="w-full h-full object-cover"
      />
    ) : (
      <Camera size={24} className="text-slate-400" />
    )}
  </div>

  <div className="p-2 space-y-1">

    <div className="flex justify-between items-center">

      <span className="text-[8px] font-black text-indigo-700 uppercase truncate">
        {item.categorias?.nome}
      </span>

      {item.tamanho_especificacao !== 'N/A' && (
        <span className="text-[8px] px-1 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold">
          {item.tamanho_especificacao}
        </span>
      )}

    </div>

    <h3 className="font-black text-[12px] leading-tight line-clamp-2">
      {item.item_nome}
    </h3>

    {item.status === 'Presente' ? (
      <span className="text-[10px] font-bold text-pink-700">
        🎁 {item.quem_presenteou || 'Presente'}
      </span>
    ) : (
      <span className="text-[13px] font-black text-indigo-900">
        R$ {Number(item.preco_pago || 0).toFixed(2)}
      </span>
    )}

    <div className="text-[9px] text-slate-500 font-bold">
      {item.qtd_pacotes * item.unidades_por_pacote} un
    </div>

  </div>

</motion.div>

))}
      </main>

      {fotoZoom && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6" onClick={() => setFotoZoom(null)}>
          <img src={fotoZoom} className="max-w-full max-h-[85vh] rounded-3xl shadow-2xl" />
        </div>
      )}

      {mostrarResumo && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setMostrarResumo(false)}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-black text-indigo-700 uppercase">Total Acumulado</h2>
              <button onClick={() => setMostrarResumo(false)}><X size={20}/></button>
            </div>

            {/* SELETOR DE RESUMO */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTipoResumo('geral')}
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                    tipoResumo === 'geral'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-200 text-slate-700'
              }`}
            >
              Geral
            </button>

           <button
            onClick={() => setTipoResumo('fraldas')}
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              tipoResumo === 'fraldas'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-200 text-slate-700'
          }`}
        >
          Fraldas
        </button>
      </div>

            
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {dadosResumo.map(r => (
                <div key={r.tamanho} className="bg-slate-50 p-3 rounded-xl border flex justify-between items-center">
                  <span className="font-black text-slate-600">{r.tamanho}</span>
                  <span className="bg-indigo-700 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold">{r.qtd} UN</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-10 py-4 pb-12 flex justify-around items-center z-30">
        <ShoppingCart size={24} className="text-indigo-700" />
        <button onClick={() => setMostrarModal(true)} className="bg-indigo-700 p-4 rounded-full text-white shadow-xl -mt-16 border-4 border-slate-50 active:scale-90 transition-all"><Plus size={28}/></button>
        <Baby size={24} className="text-slate-400" />
      </nav>

      {/* MODAL ADICIONAR - CAMPOS DE FRALDA RESTAURADOS */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] p-6 pb-12 animate-in slide-in-from-bottom duration-300 shadow-2xl text-left">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base font-black text-slate-900 uppercase">Novo Item</h2>
              <button onClick={() => setMostrarModal(false)} className="p-2 bg-slate-100 rounded-full"><X size={24}/></button>
            </div>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <input className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black outline-none border-2 border-transparent focus:border-indigo-500" placeholder="Nome do Item" value={novoItem.item_nome} onChange={e => setNovoItem({...novoItem, item_nome: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <select className="bg-slate-100 p-4 rounded-2xl text-[12px] font-black" value={novoItem.categoria_id} onChange={e => setNovoItem({...novoItem, categoria_id: e.target.value})}>
                  {listaCategorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <select className="bg-slate-100 p-4 rounded-2xl text-base font-black" value={novoItem.tamanho_especificacao} onChange={e => setNovoItem({...novoItem, tamanho_especificacao: e.target.value})}>
                  {tamanhos.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              
              {/* LÓGICA DE CAMPOS DINÂMICOS PARA FRALDA */}
              {ehFralda(novoItem.categoria_id) ? (
                <div className="grid grid-cols-2 gap-2 animate-in zoom-in-95">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-indigo-600 ml-2 uppercase">Nº de Pacotes</label>
                    <input type="number" className="bg-indigo-50 p-4 rounded-2xl text-base font-black border-2 border-indigo-200 w-full outline-none" value={novoItem.qtd_pacotes} onChange={e => setNovoItem({...novoItem, qtd_pacotes: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-indigo-600 ml-2 uppercase">Fraldas por Pacote</label>
                    <input type="number" className="bg-indigo-50 p-4 rounded-2xl text-base font-black border-2 border-indigo-200 w-full outline-none" value={novoItem.unidades_por_pacote} onChange={e => setNovoItem({...novoItem, unidades_por_pacote: Number(e.target.value)})} />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-indigo-600 ml-2 uppercase">Qtd de Unidades</label>
                   <input type="number" className="bg-indigo-50 p-4 rounded-2xl text-base font-black border-2 border-indigo-200 w-full outline-none" value={novoItem.unidades_por_pacote} onChange={e => setNovoItem({...novoItem, unidades_por_pacote: Number(e.target.value)})} />
                </div>
              )}

              <input type="number" step="0.01" className="w-full bg-slate-100 p-4 rounded-2xl text-base font-black outline-none" placeholder="Preço Pago (Unitário/Pacote)" value={novoItem.preco_pago} onChange={e => setNovoItem({...novoItem, preco_pago: e.target.value})} />
              <input type="file" accept="image/*" onChange={(e) => handleUploadFoto(e, true)} className="text-[10px] font-black" />
              <button onClick={adicionarAoEnxoval} disabled={loading} className="w-full bg-indigo-700 text-white font-black py-5 rounded-2xl text-base shadow-xl active:scale-95 transition-transform">{loading ? <Loader2 className="animate-spin mx-auto" size={24} /> : "ADICIONAR AO ENXOVAL"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIÇÃO - CAMPOS DE FRALDA RESTAURADOS */}
      {editando && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-end justify-center">
          <form onSubmit={salvarEdicao} className="bg-white w-full max-w-md rounded-t-[2.5rem] p-6 pb-12 animate-in slide-in-from-bottom duration-300 shadow-2xl text-left">
            <div className="flex justify-between items-center mb-6">
              <input className="text-base font-black text-indigo-700 uppercase bg-transparent outline-none w-full" value={editando.item_nome} onChange={e => setEditando({...editando, item_nome: e.target.value})} />
              <button type="button" onClick={() => setEditando(null)}><X size={24}/></button>
            </div>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="flex flex-col items-center gap-2">
                 <div className="h-24 w-24 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300 shadow-inner">
                   {editando.foto_url ? <img src={editando.foto_url} className="h-full w-full object-cover" /> : <Camera className="text-slate-300" />}
                 </div>
                 <input type="file" accept="image/*" onChange={(e) => handleUploadFoto(e)} className="text-[10px] font-black" />
              </div>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                {['Pendente', 'Comprado', 'Presente'].map(s => (
                  <button key={s} type="button" onClick={() => setEditando({...editando, status: s})} className={`flex-1 py-3 rounded-lg text-[10px] font-black transition-all ${editando.status === s ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500'}`}>{s.toUpperCase()}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><label className="text-[9px] font-black text-indigo-600 ml-2 uppercase">Categoria</label>
                <select className="bg-slate-100 p-4 rounded-2xl text-[12px] font-black w-full" value={editando.categoria_id} onChange={e => setEditando({...editando, categoria_id: e.target.value})}>{listaCategorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
                <div className="space-y-1"><label className="text-[9px] font-black text-indigo-600 ml-2 uppercase">Tamanho</label>
                <select className="bg-slate-100 p-4 rounded-2xl text-base font-black w-full" value={editando.tamanho_especificacao} onChange={e => setEditando({...editando, tamanho_especificacao: e.target.value})}>{tamanhos.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>

              {/* LÓGICA DE CAMPOS DE FRALDA NA EDIÇÃO */}
              {ehFralda(editando.categoria_id) ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-indigo-600 ml-2 uppercase">Nº de Pacotes</label>
                    <input type="number" className="bg-indigo-50 p-4 rounded-2xl text-base font-black border-2 border-indigo-200 w-full outline-none" value={editando.qtd_pacotes} onChange={e => setEditando({...editando, qtd_pacotes: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-indigo-600 ml-2 uppercase">Fraldas/Pacote</label>
                    <input type="number" className="bg-indigo-50 p-4 rounded-2xl text-base font-black border-2 border-indigo-200 w-full outline-none" value={editando.unidades_por_pacote} onChange={e => setEditando({...editando, unidades_por_pacote: Number(e.target.value)})} />
                  </div>
                </div>
              ) : (
                <div className="bg-indigo-50 p-4 rounded-2xl border-2 border-indigo-200">
                  <label className="text-[9px] font-black text-indigo-600 uppercase block mb-1">Quantidade de Unidades</label>
                  <input type="number" className="bg-transparent text-base font-black w-full outline-none" value={editando.unidades_por_pacote || 1} onChange={e => setEditando({...editando, unidades_por_pacote: Number(e.target.value)})} />
                </div>
              )}

              {editando.status !== 'Presente' && (
                <div className="grid grid-cols-2 gap-2">
                   <div className="space-y-1"><label className="text-[9px] font-black text-indigo-600 ml-2 uppercase tracking-widest">Marca</label><input className="bg-slate-100 p-4 rounded-2xl text-base font-black w-full outline-none" value={editando.marca || ''} onChange={e => setEditando({...editando, marca: e.target.value})} /></div>
                   <div className="space-y-1"><label className="text-[9px] font-black text-indigo-600 ml-2 uppercase tracking-widest">Preço</label><input type="number" step="0.01" className="bg-slate-100 p-4 rounded-2xl text-base font-black w-full outline-none" value={editando.preco_pago || ''} onChange={e => setEditando({...editando, preco_pago: e.target.value})} /></div>
                </div>
              )}
              {editando.status === 'Presente' && (
                <div className="space-y-1"><label className="text-[9px] font-black text-pink-600 ml-2 uppercase tracking-widest">Quem presenteou?</label>
                <input className="w-full bg-pink-50 p-4 rounded-2xl text-base font-black text-pink-900 border-2 border-pink-200 outline-none" value={editando.quem_presenteou || ''} onChange={e => setEditando({...editando, quem_presenteou: e.target.value})} /></div>
              )}
              <div className="flex gap-4 pt-4">
                 <button type="button" onClick={excluirItem} className="bg-red-50 text-red-600 p-5 rounded-2xl"><Trash2 size={24}/></button>
                 <button type="submit" className="flex-1 bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-xl uppercase active:scale-95 transition-all">
                    {loading ? <Loader2 className="animate-spin mx-auto" /> : "Salvar Alterações"}
                 </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
