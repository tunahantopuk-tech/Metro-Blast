import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Image, Vibration, SafeAreaView, StatusBar, ScrollView, Share, Alert,
} from 'react-native';

const { width: SW } = Dimensions.get('window');
const GRID_SIZE = 8;
const CS = Math.floor((SW - 60) / GRID_SIZE);
const GP = 3;

const LINES = [
  { name:'M1', bg:'#e12526' }, { name:'M2', bg:'#009a4b' },
  { name:'M3', bg:'#00a6df' }, { name:'M4', bg:'#e81776' },
  { name:'M5', bg:'#682f66' }, { name:'M6', bg:'#c8a776' },
  { name:'M7', bg:'#f598bb' }, { name:'M8', bg:'#3d7bbe' },
  { name:'M9', bg:'#ffd203' }, { name:'M10', bg:'#3fb548' },
  { name:'M11', bg:'#a65a95' }, { name:'T1', bg:'#064e7c' },
  { name:'T2', bg:'#8faba1' }, { name:'T3', bg:'#9a5528' },
  { name:'T4', bg:'#f57d47' }, { name:'T5', bg:'#7572b6' },
  { name:'T6', bg:'#e67c7c' }, { name:'F1', bg:'#7a7257' },
  { name:'F2', bg:'#7a7270' }, { name:'B1', bg:'#626569' },
  { name:'B2', bg:'#76787b' }, { name:'MBUS', bg:'#dbd499' },
];

const PC = [
  { bg:'#E2001A', glow:'#ff4d4d' }, { bg:'#00A651', glow:'#33ff88' },
  { bg:'#0072BC', glow:'#4da6ff' }, { bg:'#F7941D', glow:'#ffb84d' },
  { bg:'#8B5CF6', glow:'#a78bfa' }, { bg:'#EC4899', glow:'#f472b6' },
  { bg:'#06B6D4', glow:'#22d3ee' }, { bg:'#EAB308', glow:'#facc15' },
];

const SHAPES = [
  [[1]],[[1,1]],[[1],[1]],[[1,1,1]],[[1],[1],[1]],
  [[1,1,1,1]],[[1],[1],[1],[1]],[[1,1,1,1,1]],[[1],[1],[1],[1],[1]],
  [[1,1],[1,1]],[[1,1,1],[1,1,1],[1,1,1]],
  [[1,0],[1,1]],[[0,1],[1,1]],[[1,0],[1,0],[1,1]],[[0,1],[0,1],[1,1]],
  [[1,1,1],[0,1,0]],[[0,1,0],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]],
];

const LIGHT_BGS = ['#ffd203','#dbd499','#c8a776','#f598bb'];
const mkGrid = () => Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
const rndC = () => PC[Math.floor(Math.random() * PC.length)];
const rndB = () => Array.from({length:3}, (_, i) => ({
  shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
  color: rndC(), id: Date.now() + i + Math.random(), placed: false,
}));

const canPut = (g, s, r, c) => {
  for (let rr = 0; rr < s.length; rr++)
    for (let cc = 0; cc < s[0].length; cc++)
      if (s[rr][cc] === 1) {
        const nr = r + rr, nc = c + cc;
        if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE || g[nr][nc] !== 0) return false;
      }
  return true;
};
const putB = (g, s, r, c, ci) => {
  const ng = g.map(row => [...row]);
  for (let rr = 0; rr < s.length; rr++)
    for (let cc = 0; cc < s[0].length; cc++)
      if (s[rr][cc] === 1) ng[r + rr][c + cc] = ci;
  return ng;
};
const clrL = (g) => {
  const rows = [], cols = [];
  for (let r = 0; r < GRID_SIZE; r++) if (g[r].every(c => c !== 0)) rows.push(r);
  for (let c = 0; c < GRID_SIZE; c++) if (g.every(row => row[c] !== 0)) cols.push(c);
  if (!rows.length && !cols.length) return { grid: g, cleared: 0, cells: [] };
  const cells = [], ng = g.map(r => [...r]);
  rows.forEach(r => { for (let c = 0; c < GRID_SIZE; c++) { cells.push({r, c, color: ng[r][c]}); ng[r][c] = 0; }});
  cols.forEach(c => { for (let r = 0; r < GRID_SIZE; r++) { if (ng[r][c] !== 0) cells.push({r, c, color: ng[r][c]}); ng[r][c] = 0; }});
  return { grid: ng, cleared: rows.length + cols.length, cells };
};
const canAny = (g, bs) => {
  for (const b of bs) { if (b.placed) continue;
    for (let r = 0; r < GRID_SIZE; r++) for (let c = 0; c < GRID_SIZE; c++) if (canPut(g, b.shape, r, c)) return true;
  } return false;
};
const isEmpty = (g) => g.every(row => row.every(c => c === 0));
const dk = (hex, a) => {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const r = Math.max(0, Math.floor(parseInt(c.substring(0, 2), 16) * (1 - a)));
  const gr = Math.max(0, Math.floor(parseInt(c.substring(2, 4), 16) * (1 - a)));
  const b = Math.max(0, Math.floor(parseInt(c.substring(4, 6), 16) * (1 - a)));
  return 'rgb(' + r + ',' + gr + ',' + b + ')';
};
const findBest = (g, bs) => {
  const up = bs.filter(b => !b.placed); if (!up.length) return null;
  let best = -Infinity, mv = null;
  for (const bl of up) { for (let r = 0; r < GRID_SIZE; r++) { for (let c = 0; c < GRID_SIZE; c++) {
    if (!canPut(g, bl.shape, r, c)) continue;
    const ci = PC.indexOf(bl.color) + 1;
    const p = putB(g, bl.shape, r, c, ci);
    const { grid: cg, cleared } = clrL(p);
    let emp = 0, holes = 0;
    for (let rr = 0; rr < GRID_SIZE; rr++) for (let cc = 0; cc < GRID_SIZE; cc++) {
      if (cg[rr][cc] === 0) { emp++;
        if ((rr === 0 || cg[rr-1][cc] !== 0) && (rr === GRID_SIZE-1 || cg[rr+1][cc] !== 0) &&
            (cc === 0 || cg[rr][cc-1] !== 0) && (cc === GRID_SIZE-1 || cg[rr][cc+1] !== 0)) holes++;
      }
    }
    const sc = cleared * 100 + emp * 5 - holes * 50;
    if (sc > best) { best = sc; mv = { bi: bs.indexOf(bl), r, c }; }
  }}} return mv;
};

// Train cell
const TrainView = React.memo(({ color, size }) => {
  const p = PC[color - 1] || PC[0];
  const sm = size <= 20;
  return (
    <View style={{
      width: size, height: size, borderRadius: sm ? 4 : 7,
      backgroundColor: p.bg, overflow: 'hidden',
      shadowColor: p.glow, shadowOffset: {width:0,height:0},
      shadowOpacity: 0.4, shadowRadius: sm ? 3 : 6, elevation: 4,
    }}>
      <View style={{position:'absolute', top:sm?2:4, left:'15%', right:'15%', height:sm?2:3, backgroundColor:'rgba(255,255,255,0.35)', borderRadius:2}} />
      <View style={{position:'absolute', top:'28%', bottom:'28%', left:'48%', width:sm?1:2, backgroundColor:'rgba(255,255,255,0.12)'}} />
      <View style={{position:'absolute', top:'42%', left:sm?3:6, right:sm?3:6, flexDirection:'row', justifyContent:'space-between'}}>
        {[0,1,2].slice(0, sm?2:3).map(i => (
          <View key={i} style={{flex:1, height:sm?3:6, marginHorizontal:1, backgroundColor:'rgba(200,230,255,0.35)', borderRadius:1}} />
        ))}
      </View>
      <View style={{position:'absolute', top:sm?2:5, left:'42%', width:sm?3:5, height:sm?1.5:2.5, borderRadius:3, backgroundColor:'rgba(255,255,200,0.4)'}} />
      <View style={{position:'absolute', bottom:sm?2:4, left:'10%', right:'10%', height:sm?1.5:2.5, backgroundColor:p.glow+'44', borderRadius:2}} />
    </View>
  );
});

// ===== BADGES SCREEN =====
const BadgesScreen = ({ badges, onBack }) => {
  const earned = badges.filter(b => b.earned).length;
  const total = badges.length;

  const handleShare = async () => {
    const text = 'Metro Blast! ' + earned + '/' + total + ' rozet kazandim! ' +
      badges.filter(b => b.earned).map(b => b.name).join(', ') +
      ' | Metro Blast Oyunu';
    try {
      await Share.share({ message: text });
    } catch (e) {}
  };

  return (
    <SafeAreaView style={{flex:1, backgroundColor:'#0a0e1a'}}>
      <StatusBar barStyle="light-content" />
      <View style={{flex:1, alignItems:'center', paddingTop:10}}>
        <TouchableOpacity onPress={onBack} style={{position:'absolute', top:10, left:16, backgroundColor:'rgba(255,255,255,0.08)', borderWidth:1, borderColor:'rgba(255,255,255,0.1)', borderRadius:10, paddingHorizontal:14, paddingVertical:6, zIndex:10}}>
          <Text style={{color:'#fff', fontSize:13, fontWeight:'600'}}>{'< Geri'}</Text>
        </TouchableOpacity>
        <Text style={{fontSize:11, letterSpacing:5, color:'rgba(255,255,255,0.3)', marginTop:10, marginBottom:6}}>KOLEKSIYON</Text>
        <Text style={{fontSize:24, fontWeight:'800', letterSpacing:2, color:'#E2001A', marginBottom:4}}>ROZETLER</Text>
        <Text style={{fontSize:13, color:'rgba(255,255,255,0.4)', marginBottom:16}}>{earned} / {total} rozet kazanildi</Text>
        {/* Progress bar */}
        <View style={{width:280, height:6, borderRadius:3, backgroundColor:'rgba(255,255,255,0.08)', marginBottom:20, overflow:'hidden'}}>
          <View style={{width: (earned/total*100)+'%', height:'100%', borderRadius:3, backgroundColor:'#E2001A'}} />
        </View>
        <ScrollView contentContainerStyle={{flexDirection:'row', flexWrap:'wrap', justifyContent:'center', paddingHorizontal:16, paddingBottom:30}} style={{flex:1}}>
          {badges.map((badge, i) => (
            <View key={i} style={{
              alignItems:'center', width:80, padding:10, margin:4, borderRadius:12,
              backgroundColor: badge.earned ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.2)',
              borderWidth:1, borderColor: badge.earned ? badge.color+'44' : 'rgba(255,255,255,0.04)',
            }}>
              {/* Train icon */}
              <View style={{
                width:40, height:40, borderRadius:8, backgroundColor: badge.earned ? badge.color : '#333',
                opacity: badge.earned ? 1 : 0.3, alignItems:'center', justifyContent:'center',
                shadowColor: badge.earned ? badge.color : '#000',
                shadowOpacity: badge.earned ? 0.5 : 0, shadowRadius:8, elevation: badge.earned?4:0,
              }}>
                <View style={{width:16, height:5, backgroundColor:'rgba(200,230,255,0.4)', borderRadius:1, marginBottom:2}} />
                <View style={{width:16, height:5, backgroundColor:'rgba(200,230,255,0.4)', borderRadius:1}} />
                <View style={{flexDirection:'row', marginTop:4}}>
                  <View style={{width:5,height:5,borderRadius:3,backgroundColor:'rgba(255,255,255,0.3)',marginHorizontal:2}} />
                  <View style={{width:5,height:5,borderRadius:3,backgroundColor:'rgba(255,255,255,0.3)',marginHorizontal:2}} />
                </View>
              </View>
              {/* Name circle */}
              <View style={{
                marginTop:6, width:26, height:26, borderRadius:13,
                backgroundColor: badge.earned ? badge.color : 'rgba(255,255,255,0.06)',
                alignItems:'center', justifyContent:'center',
                borderWidth:1.5, borderColor: badge.earned ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
              }}>
                <Text style={{fontSize:badge.name.length>2?6:8, fontWeight:'800', color: badge.earned ? (LIGHT_BGS.includes(badge.color)?'#1a1a1a':'#fff') : 'rgba(255,255,255,0.2)'}}>{badge.name}</Text>
              </View>
              <Text style={{fontSize:7, color: badge.earned ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)', marginTop:3, letterSpacing:1}}>
                {badge.earned ? 'KAZANILDI' : 'KILITLI'}
              </Text>
            </View>
          ))}
        </ScrollView>
        <TouchableOpacity onPress={handleShare} style={{
          paddingHorizontal:36, paddingVertical:12, borderRadius:12, marginBottom:20,
          backgroundColor:'#1a3a5c', borderWidth:1, borderColor:'rgba(255,255,255,0.1)',
          flexDirection:'row', alignItems:'center',
        }}>
          <Text style={{color:'#fff', fontSize:14, fontWeight:'700', letterSpacing:2}}>PAYLAS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ============ MAIN APP ============
export default function App() {
  const [screen, setScreen] = useState('start');
  const [grid, setGrid] = useState(mkGrid);
  const [blocks, setBlocks] = useState(() => rndB());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [combo, setCombo] = useState(0);
  const [li, setLi] = useState(0);
  const [over, setOver] = useState(false);
  const [sel, setSel] = useState(null);
  const [clearing, setClearing] = useState([]);
  const [comboTxt, setComboTxt] = useState(null);
  const [lineTxt, setLineTxt] = useState(null);
  const [lineFrom, setLineFrom] = useState(null);
  const [aiOn, setAiOn] = useState(false);
  const [aiLeft, setAiLeft] = useState(3);
  const [badges, setBadges] = useState(() => LINES.map(l => ({name:l.name, color:l.bg, earned:false})));
  const aiRef = useRef(null);

  const cl = LINES[Math.min(li, LINES.length - 1)];
  const isLast = li >= LINES.length - 1;
  const ltBg = LIGHT_BGS.includes(cl.bg);

  const earnBadge = useCallback((idx) => {
    setBadges(prev => {
      const nb = [...prev];
      if (!nb[idx].earned) nb[idx] = {...nb[idx], earned: true};
      return nb;
    });
  }, []);

  // AI
  useEffect(() => {
    if (!aiOn || over || screen !== 'game') return;
    aiRef.current = setTimeout(() => {
      const m = findBest(grid, blocks);
      if (m) doPlace(m.bi, m.r, m.c);
      else setAiOn(false);
    }, 450);
    return () => clearTimeout(aiRef.current);
  }, [aiOn, grid, blocks, over, screen]);

  useEffect(() => {
    if (aiOn && blocks.every(b => b.placed)) setAiOn(false);
  }, [blocks, aiOn]);

  const doPlace = useCallback((bi, row, col) => {
    const bl = blocks[bi];
    if (!bl || bl.placed || !canPut(grid, bl.shape, row, col)) return;
    Vibration.vibrate(30);
    const ci = PC.indexOf(bl.color) + 1;
    const ng = putB(grid, bl.shape, row, col, ci);
    let ns = score + 10;
    const { grid: cg, cleared, cells } = clrL(ng);
    const nb = blocks.map((b, i) => i === bi ? {...b, placed:true} : b);

    if (cleared > 0) {
      Vibration.vibrate(50);
      const nc = combo + 1;
      ns += Math.floor(cleared * 100 * (1 + (Math.min(nc, 3) - 1) * 0.5));
      setCombo(nc);
      setClearing(cells);
      setComboTxt(cleared > 1 ? 'COMBO x' + cleared + '!' : nc > 1 ? 'SERi x' + nc + '!' : null);
      setTimeout(() => { setClearing([]); setComboTxt(null); }, 500);
      setGrid(cg);
      // Line progression
      if (isEmpty(cg) && !isLast) {
        const completedIdx = li;
        const fromLine = LINES[li];
        const next = li + 1;
        setLi(next);
        setLineTxt(LINES[next].name);
        setLineFrom(fromLine);
        earnBadge(completedIdx);
        Vibration.vibrate(80);
        setTimeout(() => { setLineTxt(null); setLineFrom(null); }, 2500);
      }
    } else {
      setCombo(0);
      setGrid(ng);
    }

    setScore(ns);
    if (ns > best) setBest(ns);
    setBlocks(nb);

    const fg = cleared > 0 ? cg : ng;
    if (nb.every(b => b.placed)) {
      const nxt = rndB();
      setTimeout(() => { if (!canAny(fg, nxt)) setOver(true); setBlocks(nxt); }, 300);
    } else {
      if (!canAny(fg, nb.filter(b => !b.placed))) setTimeout(() => setOver(true), 300);
    }
  }, [grid, blocks, score, combo, best, li, isLast, earnBadge]);

  const onCell = (r, c) => {
    if (sel === null) return;
    const b = blocks[sel];
    if (!b || b.placed) { setSel(null); return; }
    const tr = r - Math.floor(b.shape.length / 2);
    const tc = c - Math.floor(b.shape[0].length / 2);
    if (canPut(grid, b.shape, tr, tc)) doPlace(sel, tr, tc);
    setSel(null);
  };

  const onBlock = (i) => {
    if (blocks[i].placed || over) return;
    Vibration.vibrate(10);
    setSel(sel === i ? null : i);
  };

  const doAI = () => {
    if (aiLeft <= 0 || aiOn || over) return;
    setAiLeft(p => p - 1);
    setAiOn(true);
    Vibration.vibrate(80);
  };

  const restart = () => {
    setGrid(mkGrid()); setBlocks(rndB()); setScore(0); setCombo(0);
    setLi(0); setOver(false); setSel(null); setClearing([]);
    setComboTxt(null); setLineTxt(null); setLineFrom(null);
    setAiOn(false); setAiLeft(3);
  };

  const isCl = (r, c) => clearing.some(x => x.r === r && x.c === c);

  // ===== START SCREEN =====
  if (screen === 'start') {
    return (
      <SafeAreaView style={{flex:1, backgroundColor:'#0a0e1a'}}>
        <StatusBar barStyle="light-content" />
        <View style={{flex:1, alignItems:'center', justifyContent:'center'}}>
          <Image source={require('./assets/logo.png')} style={{width:180, height:180, borderRadius:20, marginBottom:24}} resizeMode="contain" />
          <TouchableOpacity onPress={() => setScreen('game')} activeOpacity={0.8}
            style={{paddingHorizontal:52, paddingVertical:14, borderRadius:14, backgroundColor:'#1a3a5c', borderWidth:1, borderColor:'rgba(255,255,255,0.1)', marginBottom:14}}>
            <Text style={{color:'#fff', fontSize:18, fontWeight:'700', letterSpacing:3}}>OYNA</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setScreen('badges')} activeOpacity={0.8}
            style={{paddingHorizontal:36, paddingVertical:10, borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.1)', backgroundColor:'rgba(255,255,255,0.05)'}}>
            <Text style={{color:'rgba(255,255,255,0.6)', fontSize:13, fontWeight:'600', letterSpacing:2}}>ROZETLER</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ===== BADGES SCREEN =====
  if (screen === 'badges') {
    return <BadgesScreen badges={badges} onBack={() => setScreen('start')} />;
  }

  // ===== GAME SCREEN =====
  const gridW = GRID_SIZE * (CS + GP) - GP;

  return (
    <SafeAreaView style={{flex:1, backgroundColor:dk(cl.bg, 0.65)}}>
      <StatusBar barStyle="light-content" />
      <View style={{flex:1, alignItems:'center', paddingTop:10}}>

        {/* Tunnel overlay */}
        <View style={[StyleSheet.absoluteFill, {backgroundColor:'rgba(0,0,0,0.2)'}]} pointerEvents="none" />

        {/* Header */}
        <View style={{flexDirection:'row', alignItems:'center', marginBottom:6, zIndex:10}}>
          <Image source={require('./assets/logo.png')} style={{width:30, height:30, borderRadius:6, marginRight:8}} resizeMode="contain" />
          <Text style={{fontSize:20, fontWeight:'800', color:'#fff', letterSpacing:2}}>Metro Blast!</Text>
        </View>

        {/* Score bar */}
        <View style={{flexDirection:'row', marginBottom:8, zIndex:10}}>
          {/* Line badge - round */}
          <View style={{
            backgroundColor:cl.bg, borderRadius:24, width:48, height:48,
            alignItems:'center', justifyContent:'center', marginRight:6,
            borderWidth:2, borderColor:'rgba(255,255,255,0.15)',
          }}>
            <Text style={{fontSize:cl.name.length>2?9:13, fontWeight:'800', color:ltBg?'#1a1a1a':'#fff'}}>{cl.name}</Text>
          </View>
          {[
            {l:'SKOR', v:''+score, c:'#E2001A'},
            {l:'EN IYI', v:''+best, c:'#00A651'},
            {l:'KOMBO', v:combo>0?'x'+combo:'-', c:'#EAB308', hl:combo>0},
          ].map((s, i) => (
            <View key={i} style={{
              backgroundColor:'rgba(0,0,0,0.45)', borderRadius:12, paddingHorizontal:12,
              paddingVertical:5, alignItems:'center', marginRight:6,
              borderWidth:1, borderColor:'rgba(255,255,255,0.06)',
            }}>
              <Text style={{fontSize:8, color:s.c, letterSpacing:2, marginBottom:1}}>{s.l}</Text>
              <Text style={{fontSize:16, fontWeight:'700', color:s.hl?'#EAB308':'#fff'}}>{s.v}</Text>
            </View>
          ))}
        </View>

        {/* Line transition overlay */}
        {lineTxt && (
          <View style={[StyleSheet.absoluteFill, {backgroundColor:cl.bg, alignItems:'center', justifyContent:'center', zIndex:200}]}>
            <Text style={{fontSize:12, letterSpacing:4, color:ltBg?'rgba(0,0,0,0.4)':'rgba(255,255,255,0.7)', marginBottom:8}}>YENI HAT</Text>
            <Text style={{fontSize:56, fontWeight:'900', color:ltBg?'#1a1a1a':'#fff', letterSpacing:6}}>{lineTxt}</Text>
            {lineFrom && (
              <View style={{marginTop:16, paddingHorizontal:20, paddingVertical:8, borderRadius:20, backgroundColor:lineFrom.bg, flexDirection:'row', alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.2)'}}>
                {/* Mini train */}
                <View style={{width:24, height:24, borderRadius:5, backgroundColor:lineFrom.bg, marginRight:8, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.3)'}}>
                  <View style={{width:10, height:3, backgroundColor:'rgba(200,230,255,0.5)', borderRadius:1, marginBottom:1}} />
                  <View style={{width:10, height:3, backgroundColor:'rgba(200,230,255,0.5)', borderRadius:1}} />
                  <View style={{flexDirection:'row', marginTop:2}}>
                    <View style={{width:3,height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,0.4)',marginHorizontal:1}} />
                    <View style={{width:3,height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,0.4)',marginHorizontal:1}} />
                  </View>
                </View>
                <Text style={{fontSize:13, fontWeight:'700', color:LIGHT_BGS.includes(lineFrom.bg)?'#1a1a1a':'#fff', letterSpacing:2}}>{lineFrom.name} Rozeti</Text>
              </View>
            )}
          </View>
        )}

        {/* Combo overlay */}
        {comboTxt && (
          <View style={[StyleSheet.absoluteFill, {alignItems:'center', justifyContent:'center', zIndex:60}]} pointerEvents="none">
            <Text style={{fontSize:30, fontWeight:'900', color:'#EAB308', textShadowColor:'rgba(234,179,8,0.8)', textShadowOffset:{width:0,height:0}, textShadowRadius:20}}>{comboTxt}</Text>
          </View>
        )}

        {/* Grid */}
        <View style={{
          backgroundColor:'rgba(0,0,0,0.4)', borderRadius:16, padding:8,
          borderWidth:1, borderColor:'rgba(255,255,255,0.05)', marginBottom:10, zIndex:10,
        }}>
          <View style={{width:gridW, flexDirection:'row', flexWrap:'wrap'}}>
            {grid.map((row, r) => row.map((cell, c) => {
              const cl2 = isCl(r, c);
              return (
                <TouchableOpacity key={r*GRID_SIZE+c} activeOpacity={0.7} onPress={() => onCell(r, c)}
                  style={{
                    width:CS, height:CS, borderRadius:6,
                    marginRight: c < GRID_SIZE-1 ? GP : 0,
                    marginBottom: r < GRID_SIZE-1 ? GP : 0,
                    backgroundColor: cell === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
                    borderWidth: cell === 0 ? 1 : 0,
                    borderColor: 'rgba(255,255,255,0.04)',
                    opacity: cl2 ? 0.4 : 1,
                    transform: [{scale: cl2 ? 1.15 : 1}],
                  }}>
                  {cell !== 0 && <TrainView color={cell} size={CS} />}
                </TouchableOpacity>
              );
            }))}
          </View>

          {/* Game over */}
          {over && (
            <View style={[StyleSheet.absoluteFill, {
              backgroundColor:'rgba(0,0,0,0.9)', alignItems:'center', justifyContent:'center',
              zIndex:100, borderRadius:16,
            }]}>
              <Text style={{fontSize:11, letterSpacing:4, color:'rgba(255,255,255,0.35)', marginBottom:6}}>Son Durak</Text>
              <Text style={{fontSize:30, fontWeight:'900', color:'#E2001A', marginBottom:4}}>OYUN BITTI</Text>
              <Text style={{fontSize:13, color:'rgba(255,255,255,0.4)', marginBottom:2}}>Hat: {cl.name}</Text>
              <Text style={{fontSize:13, color:'rgba(255,255,255,0.4)', marginBottom:4}}>Skorun</Text>
              <Text style={{fontSize:36, fontWeight:'800', color:'#fff', marginBottom:6}}>{score}</Text>
              <Text style={{fontSize:11, color:'rgba(255,255,255,0.3)', marginBottom:14}}>
                Rozetler: {badges.filter(b=>b.earned).length} / {badges.length}
              </Text>
              <TouchableOpacity onPress={restart} style={{
                paddingHorizontal:36, paddingVertical:12, borderRadius:12,
                backgroundColor:'#1a3a5c', borderWidth:1, borderColor:'rgba(255,255,255,0.1)',
              }}>
                <Text style={{color:'#fff', fontSize:15, fontWeight:'700', letterSpacing:2}}>TEKRAR OYNA</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Block Tray */}
        <View style={{
          backgroundColor:'rgba(0,0,0,0.3)', borderRadius:14, paddingHorizontal:16, paddingVertical:10,
          borderWidth:1, borderColor:'rgba(255,255,255,0.06)', zIndex:10, marginBottom:6,
        }}>
          <View style={{flexDirection:'row', justifyContent:'center', alignItems:'center'}}>
            {blocks.map((block, i) => {
              if (block.placed) return null;
              const isSel = sel === i;
              const ci = PC.indexOf(block.color) + 1;
              return (
                <TouchableOpacity key={block.id} activeOpacity={0.7} onPress={() => onBlock(i)}
                  style={{
                    alignItems:'center', padding:6, borderRadius:10, marginHorizontal:12,
                    borderWidth: isSel ? 2 : 0, borderColor: isSel ? block.color.bg : 'transparent',
                    transform: [{scale: isSel ? 1.12 : 1}],
                  }}>
                  {block.shape.map((row, r) => (
                    <View key={r} style={{flexDirection:'row'}}>
                      {row.map((c, cc) => (
                        <View key={cc} style={{width:18, height:18, margin:1}}>
                          {c === 1 && <TrainView color={ci} size={18} />}
                        </View>
                      ))}
                    </View>
                  ))}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Buttons */}
        <View style={{flexDirection:'row', marginTop:8, zIndex:10}}>
          <TouchableOpacity onPress={restart} style={{
            paddingHorizontal:16, paddingVertical:8, borderRadius:10, marginRight:10,
            borderWidth:1, borderColor:'rgba(255,255,255,0.1)', backgroundColor:'rgba(0,0,0,0.4)',
          }}>
            <Text style={{color:'#fff', fontSize:12, fontWeight:'600', letterSpacing:1}}>YENIDEN</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={doAI} disabled={aiLeft<=0||aiOn||over} style={{
            paddingHorizontal:16, paddingVertical:8, borderRadius:10,
            borderWidth:1,
            borderColor: aiOn ? 'rgba(234,179,8,0.4)' : aiLeft<=0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.1)',
            backgroundColor: aiOn ? 'rgba(234,179,8,0.15)' : 'rgba(0,0,0,0.4)',
            opacity: aiLeft<=0 ? 0.5 : 1,
          }}>
            <Text style={{
              fontSize:12, fontWeight:'600', letterSpacing:1,
              color: aiOn ? '#EAB308' : aiLeft<=0 ? 'rgba(255,255,255,0.2)' : '#fff',
            }}>
              {aiOn ? 'AI AKTIF' : 'AI (' + aiLeft + '/3)'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
