import React, { useEffect, useState } from ‘react’; import {
createClient } from ‘@supabase/supabase-js’; import { Mic, Camera,
Search, Plus, Baby, ShoppingCart, X, Loader2, Heart, Trash2 } from
‘lucide-react’;

// =============================== // CONEXÃO COM SUPABASE //
=============================== const supabase = createClient(
import.meta.env.VITE_SUPABASE_URL,
import.meta.env.VITE_SUPABASE_ANON_KEY );

export default function App() {

// =============================== // ESTADOS PRINCIPAIS //
=============================== const [itens, setItens] =
useState<any[]>([]); const [listaCategorias, setListaCategorias] =
useState<any[]>([]); const [busca, setBusca] = useState(’‘); const
[abaAtiva, setAbaAtiva] = useState<’Pendentes’ |
‘Comprados’>(‘Pendentes’); const [categoriaFiltro, setCategoriaFiltro] =
useState(‘Todas’); const [mostrarModal, setMostrarModal] =
useState(false); const [editando, setEditando] = useState(null); const
[fotoZoom, setFotoZoom] = useState<string | null>(null); const [loading,
setLoading] = useState(false); const [uploading, setUploading] =
useState(false);

// =============================== // TAMANHOS PADRÃO PARA ROUPAS //
=============================== const tamanhos = [
‘N/A’,‘RN’,‘P’,‘M’,‘G’,‘GG’,‘+3m’,‘+6m’,‘+9m’,‘+12m’,‘+18m’,‘+24m’ ];

// =============================== // NOVO ITEM (AGORA COM CAMPOS // DE
TAMANHO E FRALDAS) // =============================== const [novoItem,
setNovoItem] = useState({ item_nome: ’‘, categoria_id:’‘,
tamanho_especificacao: ’N/A’, marca: ’‘, preco_pago:’‘, qtd_pacotes: 1,
unidades_por_pacote: 1, local_compra:’‘, data_compra: new
Date().toISOString().split(’T’)[0], foto_url: ’‘, status: ’Pendente’ });

useEffect(() => { fetchCategorias(); fetchEnxoval(); }, []);

// =============================== // BUSCAR CATEGORIAS //
=============================== async function fetchCategorias() { const
{ data } = await supabase.from(‘categorias’).select(’*‘).order(’nome’);
if (data) { setListaCategorias(data); if (data.length > 0)
setNovoItem(prev => ({ …prev, categoria_id: data[0].id })); } }

// =============================== // BUSCAR ITENS DO ENXOVAL //
=============================== async function fetchEnxoval() {
setLoading(true); const { data } = await supabase .from(‘enxoval’)
.select(*, categorias(nome)) .eq(‘interesse’, ‘Ativo’)
.order(‘item_nome’);

    if (data) setItens(data);
    setLoading(false);

}

// =============================== // DETECTAR SE CATEGORIA É FRALDA //
=============================== const isFralda = (catId:string) => {
const cat = listaCategorias.find(c => c.id === catId); if(!cat) return
false; return cat.nome?.toLowerCase().includes(‘fralda’); };

// =============================== // COMPRESSÃO DE IMAGEM //
=============================== const comprimirImagem = (file: File):
Promise => { return new Promise((resolve) => { const reader = new
FileReader(); reader.readAsDataURL(file); reader.onload = (event) => {
const img = new Image(); img.src = event.target?.result as string;
img.onload = () => { const canvas = document.createElement(‘canvas’);
const MAX_WIDTH = 800; const scaleSize = MAX_WIDTH / img.width;
canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize; const
ctx = canvas.getContext(‘2d’); ctx?.drawImage(img, 0, 0, canvas.width,
canvas.height); ctx?.canvas.toBlob((blob) => resolve(blob as Blob),
‘image/jpeg’, 0.7); }; }; }); };

// =============================== // UPLOAD DE FOTO //
=============================== async function handleUploadFoto(e:
React.ChangeEvent, isNovo: boolean = false) { try { if (!e.target.files
|| e.target.files.length === 0) return;

      setUploading(true);

      const arquivoOriginal = e.target.files[0];
      const fotoComprimida = await comprimirImagem(arquivoOriginal);
      const fileName = `foto-${Date.now()}.jpg`;

      const { error: uploadError } =
        await supabase.storage.from('fotos-enxoval').upload(fileName, fotoComprimida);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } =
        supabase.storage.from('fotos-enxoval').getPublicUrl(fileName);

      if (isNovo)
        setNovoItem({ ...novoItem, foto_url: publicUrl });
      else if (editando)
        setEditando({ ...editando, foto_url: publicUrl });

    } catch (error:any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }

}

// =============================== // ADICIONAR ITEM //
=============================== async function adicionarAoEnxoval() {

    if (!novoItem.item_nome.trim()) return;

    setLoading(true);

    // cálculo seguro do preço
    const precoFinal =
      (Number(novoItem.preco_pago) || 0) *
      (novoItem.qtd_pacotes || 1);

    const { error } = await supabase.from('enxoval').insert([{
      item_nome: novoItem.item_nome,
      categoria_id: novoItem.categoria_id,
      tamanho_especificacao: novoItem.tamanho_especificacao,
      marca: novoItem.marca,
      preco_pago: precoFinal,
      qtd_pacotes: novoItem.qtd_pacotes,
      unidades_por_pacote: novoItem.unidades_por_pacote,
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

// =============================== // SALVAR EDIÇÃO //
=============================== async function salvarEdicao(e:
React.FormEvent) {

    e.preventDefault();
    if (!editando) return;

    setLoading(true);

    const { error } = await supabase
      .from('enxoval')
      .update({
        item_nome: editando.item_nome,
        marca: editando.status === 'Presente' ? null : editando.marca,
        preco_pago: editando.status === 'Presente' ? 0 : editando.preco_pago,
        local_compra: editando.status === 'Presente' ? null : editando.local_compra,
        data_compra: editando.data_compra,
        status: editando.status,
        categoria_id: editando.categoria_id,
        tamanho_especificacao: editando.tamanho_especificacao,
        foto_url: editando.foto_url
      })
      .eq('id', editando.id);

    if (!error) {
      setEditando(null);
      fetchEnxoval();
    } else alert(error.message);

    setLoading(false);

}

// =============================== // EXCLUIR ITEM //
=============================== async function excluirItem() { if
(!editando || !confirm(Excluir "${editando.item_nome}"?)) return;

    const { error } = await supabase
      .from('enxoval')
      .delete()
      .eq('id', editando.id);

    if (!error) {
      setEditando(null);
      fetchEnxoval();
    }

}

// =============================== // TOTAL GASTO //
=============================== const totalGasto = itens .filter(i =>
i.status === ‘Comprado’) .reduce((acc, i) => acc + Number(i.preco_pago
|| 0), 0);

// =============================== // RECONHECIMENTO DE VOZ //
=============================== const escutarVoz = (callback: (texto:
string) => void) => {

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';

    recognition.onresult = (event: any) => {
      callback(event.results[0][0].transcript);
      recognition.stop();
    };

    recognition.start();

};

// =============================== // FILTRO DE ITENS //
=============================== const itensFiltrados = itens.filter(i =>
{

    const statusMatch =
      abaAtiva === 'Pendentes'
        ? i.status === 'Pendente'
        : (i.status === 'Comprado' || i.status === 'Presente');

    const catMatch =
      categoriaFiltro === 'Todas' ||
      i.categorias?.nome === categoriaFiltro;

    return (
      statusMatch &&
      catMatch &&
      (i.item_nome ?? '')
        .toLowerCase()
        .includes(busca.toLowerCase())
    );

});

// =============================== // RENDER //
=============================== return (
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 w-full shadow-sm">

        <div className="flex justify-between items-center mb-3">

          <h1
            onClick={() => window.location.reload()}
            className="text-[17px] font-black text-indigo-700 cursor-pointer"
          >
            Jurandir Baby
          </h1>

          <div className="bg-green-100 px-3 py-1.5 rounded-lg border border-green-300">
            <span className="text-[14px] font-black text-green-800">
              R$ {totalGasto.toFixed(2)}
            </span>
          </div>

        </div>

        <div className="grid grid-cols-12 gap-2">

          <div className="col-span-8 relative">

            <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-600" />

            <input
              className="w-full rounded-xl bg-slate-100 py-3.5 pl-9 pr-10"
              placeholder="Buscar..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />

          </div>

          <div className="col-span-4">

            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="w-full bg-indigo-700 text-white py-4 rounded-xl"
            >

              <option value="Todas">TODAS</option>

              {listaCategorias.map(cat => (
                <option key={cat.id} value={cat.nome}>
                  {cat.nome.toUpperCase()}
                </option>
              ))}

            </select>

          </div>

        </div>

      </header>

      {/* LISTA */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3 w-full pb-32">

        {itensFiltrados.map((item) => (

          <div
            key={item.id}
            className="bg-white rounded-2xl p-4 shadow-md border"
          >

            <div className="flex gap-4">

              <div
                onClick={() => item.foto_url && setFotoZoom(item.foto_url)}
                className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center"
              >

                {item.foto_url
                  ? <img src={item.foto_url} className="h-full w-full object-cover" />
                  : <Camera size={24} className="text-slate-400" />
                }

              </div>

              <div onClick={() => setEditando(item)} className="flex-1">

                <div className="flex items-center gap-2 mb-1">

                  <span className="text-[10px] font-black text-indigo-700 uppercase">

                    {item.categorias?.nome || 'Outros'}

                  </span>

                  {item.tamanho_especificacao &&
                    item.tamanho_especificacao !== 'N/A' && (
                      <span className="text-[9px] px-2 py-0.5 rounded bg-slate-100 border">
                        {item.tamanho_especificacao}
                      </span>
                    )}

                </div>

                <h3 className="font-black text-[17px]">
                  {item.item_nome}
                </h3>

                <span className="text-[14px] font-black text-indigo-900">

                  R$ {Number(item.preco_pago || 0).toFixed(2)}

                </span>

              </div>

            </div>

          </div>

        ))}

      </main>

      {/* BOTÃO ADICIONAR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-10 py-4 flex justify-around">

        <ShoppingCart size={24} className="text-indigo-700" />

        <button
          onClick={() => setMostrarModal(true)}
          className="bg-indigo-700 p-4 rounded-full text-white shadow-xl"
        >
          <Plus size={28} />
        </button>

        <Baby size={24} className="text-slate-400" />

      </nav>

    </div>

); }
