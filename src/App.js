import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, query, getDoc, updateDoc, deleteDoc, writeBatch, orderBy } from 'firebase/firestore';
import { Car, Users, DollarSign, Calendar, LayoutDashboard, Settings, Edit2, CheckCircle, PlusCircle, Trash2, X, ChevronDown, Tag, AlertTriangle, Search, Filter, XCircle, Wrench, TrendingUp, Bell, Sparkles, Copy, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

// --- CONFIGURAÇÃO DO FIREBASE ---
// !! IMPORTANTE !!
// SUBSTITUA O BLOCO ABAIXO COM A SUA CONFIGURAÇÃO REAL DO FIREBASE
// Pode encontrá-la na consola do seu projeto Firebase, nas Definições do Projeto.
const firebaseConfig = {
    apiKey: "AIzaSyBjIVEt51Yj5PL-NmjkHGq4Gz3euKjcEOQ",
    authDomain: "fleetfox-ebudx.firebaseapp.com",
    projectId: "fleetfox-ebudx",
    storageBucket: "fleetfox-ebudx.firebasestorage.app",
    messagingSenderId: "717200236729",
    appId: "1:717200236729:web:cb1af9b8c665dc95087b68"
  };

// --- INICIALIZAÇÃO DO FIREBASE (NÃO ALTERAR) ---
let app;
let auth;
let db;
let appId;

// A inicialização só acontece se as chaves forem alteradas
if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "SUA_API_KEY_REAL") {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        appId = firebaseConfig.appId;
    } catch (error) {
        console.error("Erro na inicialização do Firebase:", error);
    }
}


// --- DADOS ---
const vehicleData = {
    'Fiat': ['Mobi', 'Argo', 'Cronos', 'Strada', 'Toro', 'Pulse', 'Fastback'],
    'Volkswagen': ['Polo', 'Nivus', 'T-Cross', 'Virtus', 'Saveiro', 'Voyage', 'Taos', 'Amarok'],
    'Chevrolet': ['Onix', 'Onix Plus', 'Tracker', 'Montana', 'S10', 'Spin', 'Cruze'],
    'Hyundai': ['HB20', 'HB20S', 'Creta'],
    'Renault': ['Kwid', 'Stepway', 'Logan', 'Duster', 'Oroch', 'Sandero'],
    'Toyota': ['Yaris', 'Yaris Sedan', 'Corolla', 'Corolla Cross', 'Hilux', 'RAV4'],
    'Honda': ['City', 'City Hatch', 'HR-V', 'WR-V'],
    'Nissan': ['Versa', 'Kicks', 'March', 'Sentra', 'Frontier'],
    'Jeep': ['Renegade', 'Compass', 'Commander'],
    'Ford': ['Ranger', 'Territory', 'Bronco Sport'],
};
const carColors = ['Preto', 'Branco', 'Prata', 'Cinza', 'Vermelho', 'Azul'];
const categories = [
    { id: 'uberX99Pop', label: 'Uber X / 99Pop' },
    { id: 'uberComfort', label: 'Uber Comfort' },
    { id: 'uberBlack99Plus', label: 'Uber Black / 99Plus' },
    { id: 'uberBag', label: 'Uber Bag' },
];
const eventTypes = ['Manutenção Preventiva', 'Manutenção Corretiva', 'Vistoria', 'Pagamento de Tributos', 'Pagamento de Parcelas', 'Multas'];

// --- HELPERS E API GEMINI ---
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
const parseCurrency = (value) => Number(String(value).replace(/\D/g, '')) / 100;
const formatCPF = (value) => value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').substring(0, 14);
const formatWhatsApp = (value) => value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
const getWeekOfMonth = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    const month = date.getMonth();
    const year = date.getFullYear();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const dayOfMonth = date.getDate();
    const weekNumber = Math.ceil((dayOfMonth + firstDayOfMonth) / 7);
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${weekNumber}ª semana de ${monthNames[month]}/${year}`;
};
const checkCnhValidity = (dateString) => {
    if (!dateString) return { text: 'Não informada', color: 'gray', days: Infinity };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(dateString + 'T00:00:00');
    const timeDiff = expiryDate.getTime() - today.getTime();
    const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    if (dayDiff < 0) return { text: `Vencida há ${Math.abs(dayDiff)} dias`, color: 'red', days: dayDiff };
    if (dayDiff <= 30) return { text: `Vence em ${dayDiff} dias`, color: 'yellow', days: dayDiff };
    return { text: `Válida`, color: 'green', days: dayDiff };
};

const callGeminiAPI = async (prompt) => {
    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        if (result.candidates?.[0]?.content?.parts?.[0]) {
            return result.candidates[0].content.parts[0].text;
        }
        return "Não foi possível obter uma resposta da IA. Tente novamente.";
    } catch (error) {
        console.error("Erro ao chamar a API Gemini:", error);
        return "Ocorreu um erro ao comunicar com a IA.";
    }
};

// --- COMPONENTES DA UI ---
const ConfigurationError = () => (
    <div className="flex flex-col items-center justify-center h-screen bg-red-50 text-red-800 p-8 text-center">
        <AlertTriangle size={64} className="mb-4 text-red-500" />
        <h1 className="text-3xl font-bold mb-2">Erro de Configuração do Firebase</h1>
        <p className="max-w-2xl mb-4">
            Parece que a configuração do Firebase ainda não foi adicionada ao código. A aplicação não pode funcionar sem estas chaves.
        </p>
        <div className="text-left bg-red-100 p-6 rounded-lg border border-red-200">
            <h2 className="text-xl font-semibold mb-2">Como resolver:</h2>
            <ol className="list-decimal list-inside space-y-2">
                <li>Vá à sua <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-red-900">consola do Firebase</a>.</li>
                <li>Selecione o seu projeto e vá para as <strong>Configurações do projeto</strong> (ícone de engrenagem ⚙️).</li>
                <li>Na secção <strong>"Seus apps"</strong>, encontre o objeto <strong>`firebaseConfig`</strong>.</li>
                <li>Copie o objeto inteiro e cole-o no ficheiro <strong>`App.js`</strong>, substituindo o bloco de configuração de exemplo.</li>
            </ol>
        </div>
    </div>
);


const Dashboard = ({ userId, setPage }) => {
    const [vehicles, setVehicles] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [agenda, setAgenda] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
    const [analysisResult, setAnalysisResult] = useState('');

    useEffect(() => {
        if (!userId) return;
        setIsLoading(true);
        const collections = {
            vehicles: collection(db, `artifacts/${appId}/public/data/vehicles`),
            drivers: collection(db, `artifacts/${appId}/public/data/drivers`),
            agenda: collection(db, `artifacts/${appId}/public/data/agenda`),
        };
        const unsubscribes = Object.entries(collections).map(([key, ref]) => onSnapshot(query(ref), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (key === 'vehicles') setVehicles(data);
            if (key === 'drivers') setDrivers(data);
            if (key === 'agenda') setAgenda(data);
        }));
        const timer = setTimeout(() => setIsLoading(false), 1500);
        return () => { unsubscribes.forEach(unsub => unsub()); clearTimeout(timer); };
    }, [userId]);

    const stats = useMemo(() => {
        const locados = vehicles.filter(v => v.status === 'Locado').length;
        const disponiveis = vehicles.length - locados;
        const faturamentoProjetado = vehicles.filter(v => v.status === 'Locado').reduce((sum, v) => sum + (Number(v.semanal) || 0), 0) * 4.33;
        const today = new Date(); const next7days = new Date(); next7days.setDate(today.getDate() + 7);
        const tarefasPendentes = agenda.filter(e => new Date(e.dataHora) >= today && new Date(e.dataHora) <= next7days && e.status === 'Pendente').length;
        return { locados, disponiveis, faturamentoProjetado, tarefasPendentes };
    }, [vehicles, agenda]);
    
    const handleGenerateAnalysis = async () => {
        setIsGeneratingAnalysis(true);
        setAnalysisResult('');
        const prompt = `Você é um consultor de negócios para uma empresa de aluguel de carros para motoristas de aplicativo. Analise os seguintes dados e forneça um resumo do estado atual do negócio e 3 insights acionáveis. Seja conciso, profissional e direto. Use markdown para formatar a resposta com títulos e listas. Dados Atuais: - Faturamento Mensal Projetado: ${formatCurrency(stats.faturamentoProjetado)} - Total de Veículos na Frota: ${vehicles.length} - Veículos Locados: ${stats.locados} - Veículos Disponíveis: ${stats.disponiveis} - Tarefas Urgentes (próximos 7 dias): ${stats.tarefasPendentes}`;
        const result = await callGeminiAPI(prompt);
        setAnalysisResult(result);
        setIsGeneratingAnalysis(false);
    };

    const fleetData = [{ name: 'Locados', value: stats.locados, color: '#4f46e5' }, { name: 'Disponíveis', value: stats.disponiveis, color: '#a5b4fc' }];
    const cnhsAVencer = useMemo(() => drivers.map(d => ({ ...d, validity: checkCnhValidity(d.validadeCnh) })).filter(d => d.validity.days <= 30).sort((a, b) => a.validity.days - b.validity.days), [drivers]);
    const proximasTarefas = useMemo(() => {
        const today = new Date(); const next7days = new Date(); next7days.setDate(today.getDate() + 7);
        return agenda.filter(e => new Date(e.dataHora) >= today && new Date(e.dataHora) <= next7days && e.status === 'Pendente').sort((a,b) => new Date(a.dataHora) - new Date(b.dataHora));
    }, [agenda]);

    if (isLoading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div></div>;

    return (
        <div className="p-4 md:p-8 space-y-8">
            <div className="flex flex-wrap justify-between items-center gap-4">
                 <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
                 <button onClick={handleGenerateAnalysis} disabled={isGeneratingAnalysis} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:from-purple-600 hover:to-indigo-700 transition-all flex items-center disabled:opacity-50 disabled:cursor-wait">
                    {isGeneratingAnalysis ? <Loader2 className="animate-spin mr-2" /> : <Sparkles size={18} className="mr-2" />}
                    {isGeneratingAnalysis ? 'Analisando...' : 'Gerar Análise Inteligente ✨'}
                </button>
            </div>
            {analysisResult && <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500"><h3 className="text-xl font-semibold text-gray-800 mb-2">Análise da IA</h3><div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: analysisResult.replace(/\n/g, '<br />') }}></div></div>}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Faturamento Mensal (Projeção)" value={formatCurrency(stats.faturamentoProjetado)} icon={TrendingUp} color="green" />
                <StatCard title="Veículos Locados" value={stats.locados} icon={Car} color="indigo" />
                <StatCard title="Veículos Disponíveis" value={stats.disponiveis} icon={Car} color="blue" />
                <StatCard title="Tarefas Pendentes (7 dias)" value={stats.tarefasPendentes} icon={Bell} color="yellow" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Status da Frota</h3>
                    <div style={{ width: '100%', height: 250 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie data={fleetData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{fleetData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie>
                                <Tooltip formatter={(value) => `${value} veículo(s)`}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <AlertList title="Próximas Tarefas da Agenda" items={proximasTarefas} icon={Calendar} setPage={setPage} pageId="AGENDA" renderItem={(item) => (<div><p className="font-semibold text-gray-700">{item.tipo}</p><p className="text-sm text-gray-500">{new Date(item.dataHora).toLocaleDateString('pt-BR')}</p></div>)} />
                    <AlertList title="CNHs a Vencer" items={cnhsAVencer} icon={AlertTriangle} setPage={setPage} pageId="MOTORISTAS" renderItem={(item) => (<div><p className="font-semibold text-gray-700">{item.nome}</p><p className={`text-sm font-bold ${item.validity.color === 'red' ? 'text-red-600' : 'text-yellow-600'}`}>{item.validity.text}</p></div>)} />
                </div>
            </div>
        </div>
    );
};

const TabelaPrecos = ({ userId }) => {
    const [prices, setPrices] = useState({
        semanal: { 'uberX99Pop': 600, 'uberComfort': 790, 'uberBlack99Plus': 1150, 'uberBag': 790 },
        caucao: { 'uberX99Pop': 800, 'uberComfort': 1000, 'uberBlack99Plus': 1200, 'uberBag': 1000 },
        kmExcedente: { 'uberX99Pop': 0.48, 'uberComfort': 0.63, 'uberBlack99Plus': 0.92, 'uberBag': 0.63 },
    });
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [feedback, setFeedback] = useState({ message: '', type: '' });
    const pricesDocRef = useCallback(() => doc(db, `artifacts/${appId}/public/data/prices/config`), [userId]);

    useEffect(() => {
        if (!userId) return;
        const unsubscribe = onSnapshot(pricesDocRef(), (docSnap) => {
            if (docSnap.exists()) {
                 const firestoreData = docSnap.data();
                setPrices(prev => ({
                    semanal: { ...prev.semanal, ...firestoreData.semanal },
                    caucao: { ...prev.caucao, ...firestoreData.caucao },
                    kmExcedente: { ...prev.kmExcedente, ...firestoreData.kmExcedente },
                }));
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [userId, pricesDocRef]);
    
    const handlePriceChange = (category, type, value) => setPrices(prev => ({ ...prev, [category]: { ...prev[category], [type]: value } }));

    const handleSave = async () => {
        if (!userId) return;
        try {
            await setDoc(pricesDocRef(), prices, { merge: true });
            setFeedback({ message: 'Preços salvos com sucesso!', type: 'success' }); setIsEditing(false);
        } catch (error) { setFeedback({ message: 'Falha ao salvar. Tente novamente.', type: 'error' }); }
        setTimeout(() => setFeedback({ message: '', type: '' }), 3000);
    };

    if (isLoading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div></div>;

    const PriceTableCard = ({ title, prices, categoryKey, onPriceChange, isEditing }) => (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Tag className="mr-2 text-indigo-500" size={24} />{title}</h3>
            <div className="space-y-4">
                {Object.entries(prices).map(([key, value]) => (<div key={key} className="flex items-center justify-between"><span className="text-gray-600 capitalize">{categories.find(c=>c.id === key)?.label || key}</span>{isEditing ? <CurrencyInput value={value} onValueChange={(val) => onPriceChange(categoryKey, key, val)} className="w-32 text-right px-2 py-1 border border-gray-300 rounded-md" /> : <span className="font-medium text-gray-800">{formatCurrency(value)}</span>}</div>))}
            </div>
        </div>
    );

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Tabela de Preços</h2>
                {isEditing ? <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 flex items-center"><CheckCircle size={18} className="mr-2" /> Salvar</button> : <button onClick={() => setIsEditing(true)} className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 flex items-center"><Edit2 size={18} className="mr-2" /> Editar</button>}
            </div>
            {feedback.message && <div className={`p-3 rounded-lg mb-4 text-white ${feedback.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{feedback.message}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <PriceTableCard title="Valor da Semanal" prices={prices.semanal} categoryKey="semanal" onPriceChange={handlePriceChange} isEditing={isEditing} />
                <PriceTableCard title="Valor da Caução" prices={prices.caucao} categoryKey="caucao" onPriceChange={handlePriceChange} isEditing={isEditing} />
                <PriceTableCard title="Valor KM Excedente" prices={prices.kmExcedente} categoryKey="kmExcedente" onPriceChange={handlePriceChange} isEditing={isEditing} />
            </div>
        </div>
    );
};

const CadastroVeiculos = ({ userId }) => {
    const [vehicles, setVehicles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const initialFormState = { marca: '', modelo: '', ano: '', placa: '', cor: '', renavam: '', chassi: '', valorPago: 0, fipe: 0, categorias: [], semanal: 0 };
    const [formData, setFormData] = useState(initialFormState);
    const [prices, setPrices] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState('');

    useEffect(() => {
        if (!userId) return;
        getDoc(doc(db, `artifacts/${appId}/public/data/prices/config`)).then(docSnap => { if (docSnap.exists()) setPrices(docSnap.data()); });
        const unsubscribe = onSnapshot(query(collection(db, `artifacts/${appId}/public/data/vehicles`)), (snapshot) => { setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setIsLoading(false); });
        return () => unsubscribe();
    }, [userId]);

    const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.name === 'placa' ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') : e.target.value }));
    const handleCurrencyChange = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));
    const handleCategoryChange = (e) => {
        const { value, checked } = e.target;
        const newCategorias = checked ? [...formData.categorias, value] : formData.categorias.filter(cat => cat !== value);
        let maxSemanal = 0;
        if (prices && newCategorias.length > 0) newCategorias.forEach(catId => { const price = parseFloat(prices.semanal[catId] || 0); if (price > maxSemanal) maxSemanal = price; });
        setFormData(prev => ({ ...prev, categorias: newCategorias, semanal: maxSemanal }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); if (!userId) return;
        if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(formData.placa)) { alert("Placa inválida! Use o formato Mercosul: ABC1D23 ou ABC1234."); return; }
        try { await addDoc(collection(db, `artifacts/${appId}/public/data/vehicles`), { ...formData, status: 'Disponível', createdAt: new Date() }); setShowForm(false); setFormData(initialFormState); } catch (error) { console.error("Erro ao salvar veículo:", error); }
    };

    const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - i);
    const filteredVehicles = vehicles.filter(v => !categoryFilter || v.categorias.includes(categoryFilter));

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-4"><h2 className="text-2xl md:text-3xl font-bold text-gray-800">Frota de Veículos</h2><button onClick={() => { setFormData(initialFormState); setShowForm(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 flex items-center"><PlusCircle size={18} className="mr-2" /> Adicionar Veículo</button></div>
            <div className="mb-6 bg-white p-4 rounded-lg shadow-sm flex items-center gap-4"><Filter size={20} className="text-gray-500" /><div className="flex-grow"><SelectInput name="categoryFilter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} options={categories.map(c => ({value: c.id, label: c.label}))} placeholder="Filtrar por Categoria" /></div><button onClick={() => setCategoryFilter('')} className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-300 text-sm flex items-center gap-2"><XCircle size={16}/> Limpar</button></div>
            {showForm && (<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"><div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-bold text-gray-800">Novo Veículo</h3><button onClick={() => setShowForm(false)}><X size={24} /></button></div><form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-4"><SelectInput label="Marca" name="marca" value={formData.marca} onChange={handleInputChange} options={Object.keys(vehicleData)} /><DatalistInput label="Modelo" name="modelo" value={formData.modelo} onChange={handleInputChange} options={formData.marca ? vehicleData[formData.marca] : []} disabled={!formData.marca} listId="modelos-list" /><SelectInput label="Ano" name="ano" value={formData.ano} onChange={handleInputChange} options={years} /><TextInput label="Placa (Mercosul)" name="placa" value={formData.placa} onChange={handleInputChange} placeholder="ABC1D23" maxLength="7" /><DatalistInput label="Cor" name="cor" value={formData.cor} onChange={handleInputChange} options={carColors} listId="cores-list" /></div><div className="space-y-4"><TextInput label="RENAVAM" name="renavam" value={formData.renavam} onChange={handleInputChange} /><TextInput label="Chassi" name="chassi" value={formData.chassi} onChange={handleInputChange} /><CurrencyInput label="Valor Pago" value={formData.valorPago} onValueChange={(val) => handleCurrencyChange('valorPago', val)} /><CurrencyInput label="FIPE (Manual)" value={formData.fipe} onValueChange={(val) => handleCurrencyChange('fipe', val)} /></div><div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-2">Categorias</label><div className="grid grid-cols-2 gap-4 p-4 border rounded-md">{categories.map(cat => (<label key={cat.id} className="flex items-center space-x-3"><input type="checkbox" value={cat.id} checked={formData.categorias.includes(cat.id)} onChange={handleCategoryChange} className="h-4 w-4 text-indigo-600 border-gray-300 rounded" /><span className="text-gray-700">{cat.label}</span></label>))}</div></div><div className="md:col-span-2 bg-gray-50 p-4 rounded-md flex justify-between items-center"><span className="text-lg font-semibold">Valor da Semanal:</span><span className="text-2xl font-bold text-indigo-600">{formatCurrency(formData.semanal)}</span></div><div className="md:col-span-2 flex justify-end space-x-4 mt-4"><button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg">Cancelar</button><button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow">Salvar Veículo</button></div></form></div></div>)}
            <div className="bg-white rounded-lg shadow overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Veículo</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Placa</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categorias</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Semanal</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="relative px-6 py-3"></th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{isLoading ? (<tr><td colSpan="6" className="text-center py-4">Carregando...</td></tr>) : filteredVehicles.length === 0 ? (<tr><td colSpan="6" className="text-center py-8 text-gray-500">Nenhum veículo encontrado.</td></tr>) : (filteredVehicles.map(v => (<tr key={v.id}><td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{v.marca} {v.modelo}</div><div className="text-sm text-gray-500">{v.ano} - {v.cor}</div></td><td className="px-6 py-4"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100">{v.placa}</span></td><td className="px-6 py-4 text-sm text-gray-500">{v.categorias.map(c => categories.find(cat => cat.id === c)?.label || c).join(', ')}</td><td className="px-6 py-4 text-sm font-medium">{formatCurrency(v.semanal)}</td><td className="px-6 py-4"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${v.status === 'Disponível' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{v.status}</span></td><td className="px-6 py-4 text-right text-sm font-medium"><button className="text-indigo-600"><Edit2 size={18} /></button><button className="text-red-600 ml-4"><Trash2 size={18} /></button></td></tr>)))}</tbody></table></div>
        </div>
    );
};

const CadastroMotoristas = ({ userId }) => {
    const [drivers, setDrivers] = useState([]);
    const [availableVehicles, setAvailableVehicles] = useState([]);
    const [vehiclesMap, setVehiclesMap] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingDriver, setEditingDriver] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);

    const initialFormState = { nome: '', cpf: '', cnh: '', validadeCnh: '', whatsapp: '', email: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', dataInicio: '', vehicleId: '' };
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        if (!userId) return;
        const unsubscribeDrivers = onSnapshot(query(collection(db, `artifacts/${appId}/public/data/drivers`)), (snapshot) => { setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setIsLoading(false); });
        const unsubscribeVehicles = onSnapshot(query(collection(db, `artifacts/${appId}/public/data/vehicles`)), (snapshot) => {
            const allVehicles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAvailableVehicles(allVehicles.filter(v => v.status === 'Disponível'));
            setVehiclesMap(allVehicles.reduce((acc, v) => ({ ...acc, [v.id]: v }), {}));
        });
        return () => { unsubscribeDrivers(); unsubscribeVehicles(); };
    }, [userId]);

    const handleGenerateWelcomeMessage = async () => {
        if (!formData.nome || !formData.vehicleId) { alert("Por favor, preencha o nome do motorista e selecione um veículo."); return; }
        setIsGeneratingMessage(true);
        const vehicle = vehiclesMap[formData.vehicleId];
        const prompt = `Você é o gerente de uma locadora de veículos. Crie uma mensagem de boas-vindas amigável e profissional para um novo motorista de aplicativo. A mensagem deve ser enviada por WhatsApp. Inclua o nome do motorista, o modelo do carro alugado e o valor semanal. Finalize com uma nota positiva. Dados: - Nome do Motorista: ${formData.nome} - Carro: ${vehicle.marca} ${vehicle.modelo} - Valor Semanal: ${formatCurrency(vehicle.semanal)}`;
        const result = await callGeminiAPI(prompt);
        setWelcomeMessage(result);
        setIsGeneratingMessage(false);
    };

    const handleCopyMessage = () => {
        const textArea = document.createElement("textarea");
        textArea.value = welcomeMessage; document.body.appendChild(textArea); textArea.select();
        try { document.execCommand('copy'); alert('Mensagem copiada!'); } catch (err) { console.error('Falha ao copiar texto: ', err); }
        document.body.removeChild(textArea);
    };
    
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let maskedValue = value;
        if (name === 'cpf') maskedValue = formatCPF(value);
        if (name === 'whatsapp') maskedValue = formatWhatsApp(value);
        setFormData(prev => ({ ...prev, [name]: maskedValue }));
    };

    const handleCepBlur = async (e) => {
        const cep = e.target.value.replace(/\D/g, ''); if (cep.length !== 8) return;
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();
            if (!data.erro) setFormData(prev => ({ ...prev, logradouro: data.logradouro, bairro: data.bairro, cidade: data.localidade, estado: data.uf }));
        } catch (error) { console.error("Erro ao buscar CEP:", error); }
    };

    const handleEdit = (driver) => { setEditingDriver(driver); setFormData({ ...initialFormState, ...driver }); setWelcomeMessage(''); setShowForm(true); };
    const handleAddNew = () => { setFormData(initialFormState); setEditingDriver(null); setWelcomeMessage(''); setShowForm(true); };
    
    const handleDelete = async (driverId) => {
        if (!userId) return;
        const driverToDelete = drivers.find(d => d.id === driverId); if (!driverToDelete) return;
        const batch = writeBatch(db);
        batch.delete(doc(db, `artifacts/${appId}/public/data/drivers`, driverId));
        if (driverToDelete.vehicleId) batch.update(doc(db, `artifacts/${appId}/public/data/vehicles`, driverToDelete.vehicleId), { status: 'Disponível', driverId: '' });
        try { await batch.commit(); setShowDeleteConfirm(null); } catch (error) { console.error("Erro ao excluir motorista:", error); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); if (!userId) return;
        const batch = writeBatch(db);
        try {
            if (editingDriver) {
                const driverRef = doc(db, `artifacts/${appId}/public/data/drivers`, editingDriver.id);
                batch.update(driverRef, formData);
                if (editingDriver.vehicleId !== formData.vehicleId) {
                    if (editingDriver.vehicleId) batch.update(doc(db, `artifacts/${appId}/public/data/vehicles`, editingDriver.vehicleId), { status: 'Disponível', driverId: '' });
                    if (formData.vehicleId) batch.update(doc(db, `artifacts/${appId}/public/data/vehicles`, formData.vehicleId), { status: 'Locado', driverId: editingDriver.id });
                }
            } else {
                const newDriverRef = doc(collection(db, `artifacts/${appId}/public/data/drivers`));
                batch.set(newDriverRef, { ...formData, id: newDriverRef.id, createdAt: new Date() });
                if (formData.vehicleId) batch.update(doc(db, `artifacts/${appId}/public/data/vehicles`, formData.vehicleId), { status: 'Locado', driverId: newDriverRef.id });
            }
            await batch.commit(); setShowForm(false); setFormData(initialFormState); setEditingDriver(null);
        } catch (error) { console.error("Erro ao salvar motorista:", error); }
    };
    
    const CnhStatusBadge = ({ dateString }) => {
        const status = checkCnhValidity(dateString);
        const colorClasses = { red: 'bg-red-100 text-red-800', yellow: 'bg-yellow-100 text-yellow-800', green: 'bg-green-100 text-green-800', gray: 'bg-gray-100 text-gray-800' };
        return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClasses[status.color]}`}>{status.text}</span>;
    };
    
    const vehiclesForSelect = availableVehicles.map(v => ({ value: v.id, label: `${v.marca} ${v.modelo} - ${v.placa}` }));
    if (editingDriver && editingDriver.vehicleId && !availableVehicles.some(v => v.id === editingDriver.vehicleId)) {
        const currentVehicle = vehiclesMap[editingDriver.vehicleId];
        if(currentVehicle) vehiclesForSelect.unshift({ value: currentVehicle.id, label: `${currentVehicle.marca} ${currentVehicle.modelo} - ${currentVehicle.placa}` });
    }

    const filteredDrivers = drivers.filter(d => d.nome.toLowerCase().includes(searchTerm.toLowerCase()) || d.cpf.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, '')));

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-4"><h2 className="text-2xl md:text-3xl font-bold text-gray-800">Motoristas</h2><button onClick={handleAddNew} className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 flex items-center"><PlusCircle size={18} className="mr-2" /> Adicionar Motorista</button></div>
            <div className="mb-6 bg-white p-4 rounded-lg shadow-sm flex items-center gap-4"><Search size={20} className="text-gray-500" /><TextInput placeholder="Buscar por nome ou CPF..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="!mt-0 flex-grow" /></div>
            {showForm && (<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"><div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-bold text-gray-800">{editingDriver ? 'Editar Motorista' : 'Novo Motorista'}</h3><button onClick={() => setShowForm(false)}><X size={24} /></button></div><form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="space-y-4 md:col-span-2"><TextInput label="Nome Completo" name="nome" value={formData.nome} onChange={handleInputChange} required /><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><TextInput label="CPF" name="cpf" value={formData.cpf} onChange={handleInputChange} maxLength="14" /><TextInput label="CNH" name="cnh" value={formData.cnh} onChange={handleInputChange} /><TextInput label="Validade CNH" name="validadeCnh" type="date" value={formData.validadeCnh} onChange={handleInputChange} /><TextInput label="WhatsApp" name="whatsapp" value={formData.whatsapp} onChange={handleInputChange} maxLength="15" /></div><TextInput label="E-mail" name="email" type="email" value={formData.email} onChange={handleInputChange} /></div><div className="space-y-4 md:col-span-1"><TextInput label="CEP" name="cep" value={formData.cep} onChange={handleInputChange} onBlur={handleCepBlur} /><TextInput label="Logradouro" name="logradouro" value={formData.logradouro} onChange={handleInputChange} /><TextInput label="Número" name="numero" value={formData.numero} onChange={handleInputChange} /><TextInput label="Complemento" name="complemento" value={formData.complemento} onChange={handleInputChange} /><TextInput label="Bairro" name="bairro" value={formData.bairro} onChange={handleInputChange} /><TextInput label="Cidade" name="cidade" value={formData.cidade} onChange={handleInputChange} /><TextInput label="Estado" name="estado" value={formData.estado} onChange={handleInputChange} /></div><div className="md:col-span-3 border-t pt-6 mt-2 space-y-4"><h4 className="text-lg font-semibold text-gray-700">Detalhes da Locação</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><TextInput label="Data de Início da Locação" name="dataInicio" type="date" value={formData.dataInicio} onChange={handleInputChange} /><SelectInput label="Veículo Alugado" name="vehicleId" value={formData.vehicleId} onChange={handleInputChange} options={vehiclesForSelect} /></div></div><div className="md:col-span-3 space-y-4"><button type="button" onClick={handleGenerateWelcomeMessage} disabled={isGeneratingMessage} className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-lg shadow flex items-center justify-center disabled:opacity-50"><Sparkles size={18} className="mr-2" />{isGeneratingMessage ? 'A criar...' : 'Gerar Mensagem de Boas-Vindas ✨'}</button>{welcomeMessage && <div className="relative"><TextAreaInput label="Mensagem Gerada" value={welcomeMessage} readOnly rows="5" /><button type="button" onClick={handleCopyMessage} className="absolute top-8 right-2 text-gray-500"><Copy size={18} /></button></div>}</div><div className="md:col-span-3 flex justify-end space-x-4 mt-4"><button type="button" onClick={() => {setShowForm(false); setEditingDriver(null);}} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg">Cancelar</button><button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow">Salvar</button></div></form></div></div>)}
            {showDeleteConfirm && (<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"><div className="bg-white rounded-lg p-8 shadow-xl"><h3 className="text-lg font-bold">Confirmar Exclusão</h3><p className="my-4">Tem certeza que deseja excluir o motorista <span className="font-semibold">{showDeleteConfirm.nome}</span>?</p><div className="flex justify-end space-x-4"><button onClick={() => setShowDeleteConfirm(null)} className="bg-gray-200 px-4 py-2 rounded-lg">Cancelar</button><button onClick={() => handleDelete(showDeleteConfirm.id)} className="bg-red-600 text-white px-4 py-2 rounded-lg">Excluir</button></div></div></div>)}
            <div className="bg-white rounded-lg shadow overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motorista</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contato</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validade CNH</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Veículo Locado</th><th className="relative px-6 py-3"></th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{isLoading ? (<tr><td colSpan="5" className="text-center py-4">Carregando...</td></tr>) : filteredDrivers.length === 0 ? (<tr><td colSpan="5" className="text-center py-8 text-gray-500">Nenhum motorista encontrado.</td></tr>) : (filteredDrivers.map(d => { const v = d.vehicleId ? vehiclesMap[d.vehicleId] : null; return (<tr key={d.id}><td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{d.nome}</div><div className="text-sm text-gray-500">CPF: {d.cpf}</div></td><td className="px-6 py-4"><div className="text-sm text-gray-900">{d.whatsapp}</div><div className="text-sm text-gray-500">{d.email}</div></td><td className="px-6 py-4"><CnhStatusBadge dateString={d.validadeCnh} /></td><td className="px-6 py-4 text-sm">{v ? `${v.marca} ${v.modelo} (${v.placa})` : <span className="text-gray-400 italic">Nenhum</span>}</td><td className="px-6 py-4 text-right text-sm font-medium"><button onClick={() => handleEdit(d)} className="text-indigo-600"><Edit2 size={18} /></button><button onClick={() => setShowDeleteConfirm(d)} className="text-red-600 ml-4"><Trash2 size={18} /></button></td></tr>); }))}</tbody></table></div>
        </div>
    );
};

const LancamentoPagamentos = ({ userId }) => {
    const [payments, setPayments] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [vehiclesMap, setVehiclesMap] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingPayment, setEditingPayment] = useState(null);
    const [filters, setFilters] = useState({ metodo: '', status: '' });
    const today = new Date().toISOString().split('T')[0];
    const initialFormState = { dataPagamento: today, driverId: '', vehicleId: '', valorPago: 0, metodo: 'PIX', status: 'Pago em dia', periodo: getWeekOfMonth(today) };
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        if (!userId) return;
        const q = query(collection(db, `artifacts/${appId}/public/data/payments`), orderBy('dataPagamento', 'desc'));
        const unsubscribePayments = onSnapshot(q, (snapshot) => { setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setIsLoading(false); });
        const unsubscribeDrivers = onSnapshot(query(collection(db, `artifacts/${appId}/public/data/drivers`)), (snapshot) => setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubscribeVehicles = onSnapshot(query(collection(db, `artifacts/${appId}/public/data/vehicles`)), (snapshot) => setVehiclesMap(snapshot.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {})));
        return () => { unsubscribePayments(); unsubscribeDrivers(); unsubscribeVehicles(); };
    }, [userId]);

    const handleFilterChange = (e) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        const newFormData = { ...formData, [name]: value };
        if (name === 'dataPagamento') newFormData.periodo = getWeekOfMonth(value);
        if (name === 'driverId') {
            const driver = drivers.find(d => d.id === value);
            if (driver?.vehicleId) { const vehicle = vehiclesMap[driver.vehicleId]; newFormData.vehicleId = driver.vehicleId; if(vehicle) newFormData.valorPago = vehicle.semanal || 0; } else { newFormData.vehicleId = ''; newFormData.valorPago = 0; }
        }
        setFormData(newFormData);
    };
    const handleCurrencyChange = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));
    const handleEdit = (payment) => { setEditingPayment(payment); setFormData({ ...initialFormState, ...payment }); setShowForm(true); };
    const handleDelete = async (paymentId) => { if (!userId) return; await deleteDoc(doc(db, `artifacts/${appId}/public/data/payments`, paymentId)); };
    const handleSubmit = async (e) => {
        e.preventDefault(); if (!userId) return;
        try {
            if (editingPayment) await updateDoc(doc(db, `artifacts/${appId}/public/data/payments`, editingPayment.id), formData);
            else await addDoc(collection(db, `artifacts/${appId}/public/data/payments`), formData);
            setShowForm(false); setFormData(initialFormState); setEditingPayment(null);
        } catch (error) { console.error("Erro ao salvar pagamento:", error); }
    };
    
    const statusColors = { 'Pago em dia': 'bg-blue-100 text-blue-800', 'Pago em atraso': 'bg-yellow-100 text-yellow-800', 'Não pago': 'bg-red-100 text-red-800' };
    const paymentMethods = [{id: 'PIX', label: 'PIX'}, {id: 'Dinheiro', label: 'Dinheiro'}, {id: 'Cartão de Crédito', label: 'Cartão de Crédito'}];
    const paymentStatusOptions = [{id: 'Pago em dia', label: 'Pago em dia'}, {id: 'Pago em atraso', label: 'Pago em atraso'}, {id: 'Não pago', label: 'Não pago'}];
    const filteredPayments = payments.filter(p => (!filters.metodo || p.metodo === filters.metodo) && (!filters.status || p.status === filters.status));

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-4"><h2 className="text-2xl md:text-3xl font-bold text-gray-800">Pagamentos</h2><button onClick={() => { setFormData(initialFormState); setEditingPayment(null); setShowForm(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 flex items-center"><PlusCircle size={18} className="mr-2" /> Adicionar Pagamento</button></div>
            <div className="mb-6 bg-white p-4 rounded-lg shadow-sm flex items-center gap-4 flex-wrap"><Filter size={20} className="text-gray-500" /><div className="flex-grow min-w-[150px]"><SelectInput name="metodo" value={filters.metodo} onChange={handleFilterChange} options={paymentMethods.map(m => ({ value: m.id, label: m.label }))} placeholder="Filtrar por Método" /></div><div className="flex-grow min-w-[150px]"><SelectInput name="status" value={filters.status} onChange={handleFilterChange} options={paymentStatusOptions.map(s => ({ value: s.id, label: s.label }))} placeholder="Filtrar por Status" /></div><button onClick={() => setFilters({ metodo: '', status: '' })} className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-300 text-sm flex items-center gap-2"><XCircle size={16}/> Limpar Filtros</button></div>
            {showForm && (<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"><div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-bold text-gray-800">{editingPayment ? 'Editar Pagamento' : 'Novo Pagamento'}</h3><button onClick={() => setShowForm(false)}><X size={24} /></button></div><form onSubmit={handleSubmit} className="space-y-4"><TextInput label="Data do Pagamento" name="dataPagamento" type="date" value={formData.dataPagamento} onChange={handleInputChange} required /><TextInput label="Período Referente" name="periodo" value={formData.periodo} readOnly disabled /><SelectInput label="Motorista" name="driverId" value={formData.driverId} onChange={handleInputChange} options={drivers.map(d => ({ value: d.id, label: d.nome }))} required /><div><label className="block text-sm font-medium">Veículo</label><p className="mt-1 text-gray-800 h-10 flex items-center px-3 bg-gray-100 rounded-md">{formData.vehicleId && vehiclesMap[formData.vehicleId] ? `${vehiclesMap[formData.vehicleId]?.marca} ${vehiclesMap[formData.vehicleId]?.modelo}` : 'Selecione um motorista'}</p></div><CurrencyInput label="Valor Pago" value={formData.valorPago} onValueChange={(val) => handleCurrencyChange('valorPago', val)} /><SelectInput label="Método de Pagamento" name="metodo" value={formData.metodo} onChange={handleInputChange} options={paymentMethods.map(m => ({ value: m.id, label: m.label }))} /><SelectInput label="Status do Pagamento" name="status" value={formData.status} onChange={handleInputChange} options={paymentStatusOptions.map(s => ({ value: s.id, label: s.label }))} /><div className="flex justify-end space-x-4 pt-4"><button type="button" onClick={() => {setShowForm(false); setEditingPayment(null);}} className="bg-gray-200 px-6 py-2 rounded-lg">Cancelar</button><button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow">Salvar</button></div></form></div></div>)}
            <div className="bg-white rounded-lg shadow overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motorista</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="relative px-6 py-3"></th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{isLoading ? (<tr><td colSpan="5" className="text-center py-4">Carregando...</td></tr>) : filteredPayments.length === 0 ? (<tr><td colSpan="5" className="text-center py-8 text-gray-500">Nenhum pagamento encontrado.</td></tr>) : (filteredPayments.map(p => (<tr key={p.id}><td className="px-6 py-4"><div className="text-sm font-medium">{new Date(p.dataPagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</div><div className="text-sm text-gray-500">{p.periodo}</div></td><td className="px-6 py-4"><div className="text-sm font-medium">{drivers.find(d => d.id === p.driverId)?.nome}</div><div className="text-sm text-gray-500">{p.vehicleId && vehiclesMap[p.vehicleId] ? `${vehiclesMap[p.vehicleId]?.marca} ${vehiclesMap[p.vehicleId]?.modelo}` : ''}</div></td><td className="px-6 py-4 text-sm font-medium">{formatCurrency(p.valorPago)}</td><td className="px-6 py-4"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[p.status]}`}>{p.status}</span></td><td className="px-6 py-4 text-right text-sm font-medium"><button onClick={() => handleEdit(p)} className="text-indigo-600"><Edit2 size={18} /></button><button onClick={() => handleDelete(p.id)} className="text-red-600 ml-4"><Trash2 size={18} /></button></td></tr>)))}</tbody></table></div>
        </div>
    );
};

const AgendaTarefas = ({ userId }) => {
    const [events, setEvents] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [vehiclesMap, setVehiclesMap] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [filters, setFilters] = useState({ vehicleId: '', tipo: '', status: '' });
    const today = new Date().toISOString().slice(0, 16);
    const initialFormState = { dataHora: today, tipo: eventTypes[0], descricao: '', vehicleId: '', status: 'Pendente' };
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        if (!userId) return;
        const qEvents = query(collection(db, `artifacts/${appId}/public/data/agenda`), orderBy('dataHora', 'desc'));
        const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const qVehicles = query(collection(db, `artifacts/${appId}/public/data/vehicles`));
        const unsubscribeVehicles = onSnapshot(qVehicles, (snapshot) => {
            const vehicleList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setVehicles(vehicleList); setVehiclesMap(vehicleList.reduce((acc, v) => ({ ...acc, [v.id]: v }), {}));
        });
        setIsLoading(false);
        return () => { unsubscribeEvents(); unsubscribeVehicles(); };
    }, [userId]);

    const handleFilterChange = (e) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleEdit = (event) => { setEditingEvent(event); setFormData({ ...initialFormState, ...event }); setShowForm(true); };
    const handleDelete = async (eventId) => { if (!userId) return; await deleteDoc(doc(db, `artifacts/${appId}/public/data/agenda`, eventId)); };
    const handleToggleStatus = async (event) => { if (!userId) return; await updateDoc(doc(db, `artifacts/${appId}/public/data/agenda`, event.id), { status: event.status === 'Pendente' ? 'Concluída' : 'Pendente' }); };
    const handleSubmit = async (e) => {
        e.preventDefault(); if (!userId) return;
        try {
            if (editingEvent) await updateDoc(doc(db, `artifacts/${appId}/public/data/agenda`, editingEvent.id), formData);
            else await addDoc(collection(db, `artifacts/${appId}/public/data/agenda`), formData);
            setShowForm(false); setFormData(initialFormState); setEditingEvent(null);
        } catch (error) { console.error("Erro ao salvar evento:", error); }
    };

    const filteredEvents = events.filter(e => (!filters.vehicleId || e.vehicleId === filters.vehicleId) && (!filters.tipo || e.tipo === filters.tipo) && (!filters.status || e.status === filters.status));
    const statusColors = { 'Pendente': 'bg-yellow-100 text-yellow-800', 'Concluída': 'bg-green-100 text-green-800' };

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-4"><h2 className="text-2xl md:text-3xl font-bold text-gray-800">Agenda de Tarefas</h2><button onClick={() => { setFormData(initialFormState); setEditingEvent(null); setShowForm(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 flex items-center"><PlusCircle size={18} className="mr-2" /> Agendar Tarefa</button></div>
            <div className="mb-6 bg-white p-4 rounded-lg shadow-sm flex items-center gap-4 flex-wrap"><Filter size={20} className="text-gray-500" /><div className="flex-grow min-w-[150px]"><SelectInput name="vehicleId" value={filters.vehicleId} onChange={handleFilterChange} options={vehicles.map(v => ({ value: v.id, label: `${v.marca} ${v.modelo} (${v.placa})` }))} placeholder="Filtrar por Veículo" /></div><div className="flex-grow min-w-[150px]"><SelectInput name="tipo" value={filters.tipo} onChange={handleFilterChange} options={eventTypes} placeholder="Filtrar por Tipo" /></div><div className="flex-grow min-w-[150px]"><SelectInput name="status" value={filters.status} onChange={handleFilterChange} options={['Pendente', 'Concluída']} placeholder="Filtrar por Status" /></div><button onClick={() => setFilters({ vehicleId: '', tipo: '', status: '' })} className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-300 text-sm flex items-center gap-2"><XCircle size={16}/> Limpar Filtros</button></div>
            {showForm && (<div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4"><div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-bold text-gray-800">{editingEvent ? 'Editar Tarefa' : 'Nova Tarefa'}</h3><button onClick={() => setShowForm(false)}><X size={24} /></button></div><form onSubmit={handleSubmit} className="space-y-4"><TextInput label="Data e Hora" name="dataHora" type="datetime-local" value={formData.dataHora} onChange={handleInputChange} required /><SelectInput label="Veículo" name="vehicleId" value={formData.vehicleId} onChange={handleInputChange} options={vehicles.map(v => ({ value: v.id, label: `${v.marca} ${v.modelo} (${v.placa})` }))} required /><SelectInput label="Tipo de Tarefa" name="tipo" value={formData.tipo} onChange={handleInputChange} options={eventTypes} required /><TextAreaInput label="Descrição" name="descricao" value={formData.descricao} onChange={handleInputChange} rows="3" /><SelectInput label="Status" name="status" value={formData.status} onChange={handleInputChange} options={['Pendente', 'Concluída']} /><div className="flex justify-end space-x-4 pt-4"><button type="button" onClick={() => {setShowForm(false); setEditingEvent(null);}} className="bg-gray-200 px-6 py-2 rounded-lg">Cancelar</button><button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow">Salvar</button></div></form></div></div>)}
            <div className="bg-white rounded-lg shadow overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data/Hora</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Veículo</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarefa</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="relative px-6 py-3"></th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{isLoading ? (<tr><td colSpan="5" className="text-center py-4">Carregando...</td></tr>) : filteredEvents.length === 0 ? (<tr><td colSpan="5" className="text-center py-8 text-gray-500">Nenhuma tarefa encontrada.</td></tr>) : (filteredEvents.map(e => { const v = vehiclesMap[e.vehicleId]; return (<tr key={e.id}><td className="px-6 py-4"><div className="text-sm font-medium">{new Date(e.dataHora).toLocaleString('pt-BR')}</div></td><td className="px-6 py-4"><div className="text-sm font-medium">{v ? `${v.marca} ${v.modelo}` : 'N/A'}</div><div className="text-sm text-gray-500">{v ? v.placa : ''}</div></td><td className="px-6 py-4"><div className="text-sm font-medium">{e.tipo}</div><div className="text-sm text-gray-500 truncate max-w-xs">{e.descricao}</div></td><td className="px-6 py-4"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[e.status]}`}>{e.status}</span></td><td className="px-6 py-4 text-right text-sm font-medium flex items-center gap-2"><button onClick={() => handleToggleStatus(e)} className={`text-white px-2 py-1 rounded text-xs ${e.status === 'Pendente' ? 'bg-green-500' : 'bg-gray-400'}`}>{e.status === 'Pendente' ? 'Concluir' : 'Reabrir'}</button><button onClick={() => handleEdit(e)} className="text-indigo-600"><Edit2 size={18} /></button><button onClick={() => handleDelete(e.id)} className="text-red-600"><Trash2 size={18} /></button></td></tr>); }))}</tbody></table></div>
        </div>
    );
};

// --- Componentes Genéricos ---
const StatCard = ({ title, value, icon: Icon, color }) => { const colors = { green: 'bg-green-500', indigo: 'bg-indigo-500', blue: 'bg-blue-500', yellow: 'bg-yellow-500' }; return (<div className="bg-white p-6 rounded-lg shadow-md flex items-center"><div className={`p-3 rounded-full text-white mr-4 ${colors[color]}`}><Icon size={24} /></div><div><p className="text-sm text-gray-500">{title}</p><p className="text-2xl font-bold text-gray-800">{value}</p></div></div>);};
const AlertList = ({ title, items, icon: Icon, setPage, pageId, renderItem }) => (<div className="bg-white p-6 rounded-lg shadow-md"><h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Icon className="mr-2" />{title}</h3><div className="space-y-3 max-h-64 overflow-y-auto">{items.length > 0 ? items.map(item => (<div key={item.id} className="bg-gray-50 p-3 rounded-md">{renderItem(item)}</div>)) : <p className="text-gray-500 text-sm">Nenhum alerta no momento.</p>}</div><button onClick={() => setPage(pageId)} className="text-indigo-600 hover:text-indigo-800 text-sm mt-4 font-semibold">Ver todos</button></div>);
const TextInput = ({ label, ...props }) => (<div>{label && <label className="block text-sm font-medium text-gray-700">{label}</label>}<input {...props} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-200" /></div>);
const TextAreaInput = ({ label, ...props }) => (<div>{label && <label className="block text-sm font-medium text-gray-700">{label}</label>}<textarea {...props} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-200" /></div>);
const CurrencyInput = ({ label, value, onValueChange, ...props }) => { const handleChange = (e) => onValueChange(parseCurrency(e.target.value)); return (<div>{label && <label className="block text-sm font-medium text-gray-700">{label}</label>}<input {...props} type="text" value={formatCurrency(value)} onChange={handleChange} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" /></div>);};
const SelectInput = ({ label, name, value, onChange, options, placeholder, ...props }) => (<div>{label && <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>}<div className="relative"><select id={name} name={name} value={value} onChange={onChange} {...props} className="appearance-none mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"><option value="">{placeholder || label || 'Selecione...'}</option>{options.map(opt => <option key={opt.value || opt} value={opt.value || opt}>{opt.label || opt}</option>)}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" /></div></div>);
const DatalistInput = ({ label, name, value, onChange, options, listId, ...props }) => (<div><label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label><input id={name} name={name} value={value} onChange={onChange} list={listId} {...props} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100" /><datalist id={listId}>{options.map(opt => <option key={opt} value={opt} />)}</datalist></div>);

const Sidebar = ({ activePage, setPage }) => {
    const navItems = [
        { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard }, { id: 'VEICULOS', label: 'Veículos', icon: Car }, { id: 'MOTORISTAS', label: 'Motoristas', icon: Users }, { id: 'PAGAMENTOS', label: 'Pagamentos', icon: DollarSign }, { id: 'AGENDA', label: 'Agenda', icon: Calendar }, { id: 'PRECOS', label: 'Tabela de Preços', icon: Settings },
    ];
    return (
        <div className="w-16 md:w-64 bg-gray-800 text-white flex flex-col transition-all duration-300">
            <div className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-gray-700"><Car className="text-indigo-400 h-8 w-8" /><h1 className="hidden md:block ml-3 text-xl font-bold">GestãoFrota</h1></div>
            <nav className="flex-grow mt-4">{navItems.map(item => (<button key={item.id} onClick={() => setPage(item.id)} className={`flex items-center w-full h-12 px-4 md:px-6 my-1 transition-colors duration-200 ${activePage === item.id ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}><item.icon className="h-6 w-6" /><span className="hidden md:block ml-4">{item.label}</span></button>))}</nav>
        </div>
    );
};

export default function App() {
    const [page, setPage] = useState('DASHBOARD');
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // Mostra um erro se as chaves do Firebase não forem preenchidas
    if (!app) {
        return <ConfigurationError />;
    }

    useEffect(() => {
        const initAuth = async () => {
            try {
                // Para o site público, usamos sempre o login anónimo.
                await signInAnonymously(auth);
            } catch (error) { 
                console.error("Authentication error:", error); 
            }
        };
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) setUserId(user.uid); else setUserId(null);
            setIsAuthReady(true);
        });
        initAuth();
        return () => unsubscribe();
    }, []);

    const renderPage = () => {
        if (!isAuthReady) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div><p className="ml-4 text-gray-600">Autenticando...</p></div>;
        
        switch (page) {
            case 'DASHBOARD': return <Dashboard userId={userId} setPage={setPage} />;
            case 'VEICULOS': return <CadastroVeiculos userId={userId} />;
            case 'MOTORISTAS': return <CadastroMotoristas userId={userId} />;
            case 'PAGAMENTOS': return <LancamentoPagamentos userId={userId} />;
            case 'AGENDA': return <AgendaTarefas userId={userId} />;
            case 'PRECOS': return <TabelaPrecos userId={userId} />;
            default: return <Dashboard userId={userId} setPage={setPage} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            <Sidebar activePage={page} setPage={setPage} />
            <main className="flex-1 flex flex-col overflow-hidden"><div className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">{renderPage()}</div></main>
        </div>
    );
}