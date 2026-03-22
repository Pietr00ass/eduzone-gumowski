/** @import { Question } from './types.js' */

/** @type {Question[]} */
export const questionSeed = [
  {
    id: 'hist-1',
    prompt: 'W którym roku uchwalono Konstytucję 3 maja?',
    options: [
      { id: 'a', text: '1772' },
      { id: 'b', text: '1791' },
      { id: 'c', text: '1807' },
      { id: 'd', text: '1918' },
    ],
    correctOptionId: 'b',
    category: 'historia',
    explanation: 'Konstytucja 3 maja została uchwalona 3 maja 1791 roku.',
  },
  {
    id: 'nauka-1',
    prompt: 'Jaka planeta jest nazywana Czerwoną Planetą?',
    options: [
      { id: 'a', text: 'Wenus' },
      { id: 'b', text: 'Jowisz' },
      { id: 'c', text: 'Mars' },
      { id: 'd', text: 'Merkury' },
    ],
    correctOptionId: 'c',
    category: 'nauka',
    explanation: 'Mars zawdzięcza przydomek czerwonawej barwie powierzchni.',
  },
  {
    id: 'tech-1',
    prompt: 'Który skrót oznacza kaskadowe arkusze stylów?',
    options: [
      { id: 'a', text: 'HTML' },
      { id: 'b', text: 'CSS' },
      { id: 'c', text: 'SQL' },
      { id: 'd', text: 'HTTP' },
    ],
    correctOptionId: 'b',
    category: 'technologia',
    explanation: 'CSS to Cascading Style Sheets.',
  },
  {
    id: 'sport-1',
    prompt: 'Ilu zawodników liczy podstawowy skład drużyny piłkarskiej na boisku?',
    options: [
      { id: 'a', text: '9' },
      { id: 'b', text: '10' },
      { id: 'c', text: '11' },
      { id: 'd', text: '12' },
    ],
    correctOptionId: 'c',
    category: 'sport',
  },
  {
    id: 'geo-1',
    prompt: 'Jakie jest najdłuższe pasmo górskie na lądzie?',
    options: [
      { id: 'a', text: 'Andy' },
      { id: 'b', text: 'Himalaje' },
      { id: 'c', text: 'Alpy' },
      { id: 'd', text: 'Karpaty' },
    ],
    correctOptionId: 'a',
    category: 'geografia',
    explanation: 'Andy ciągną się wzdłuż zachodniego wybrzeża Ameryki Południowej.',
  },
  {
    id: 'hist-2',
    prompt: 'Które starożytne miasto zostało zniszczone przez wybuch Wezuwiusza w 79 roku?',
    options: [
      { id: 'a', text: 'Sparta' },
      { id: 'b', text: 'Pompeje' },
      { id: 'c', text: 'Kartagina' },
      { id: 'd', text: 'Troja' },
    ],
    correctOptionId: 'b',
    category: 'historia',
  },
  {
    id: 'nauka-2',
    prompt: 'Jaki pierwiastek chemiczny ma symbol O?',
    options: [
      { id: 'a', text: 'Złoto' },
      { id: 'b', text: 'Tlen' },
      { id: 'c', text: 'Ołów' },
      { id: 'd', text: 'Sód' },
    ],
    correctOptionId: 'b',
    category: 'nauka',
  },
  {
    id: 'tech-2',
    prompt: 'Która struktura danych działa zgodnie z zasadą LIFO?',
    options: [
      { id: 'a', text: 'Queue' },
      { id: 'b', text: 'Graph' },
      { id: 'c', text: 'Stack' },
      { id: 'd', text: 'Tree' },
    ],
    correctOptionId: 'c',
    category: 'technologia',
  },
  {
    id: 'sport-2',
    prompt: 'W jakiej dyscyplinie używa się terminu grand slam?',
    options: [
      { id: 'a', text: 'Tenis' },
      { id: 'b', text: 'Siatkówka' },
      { id: 'c', text: 'Pływanie' },
      { id: 'd', text: 'Skoki narciarskie' },
    ],
    correctOptionId: 'a',
    category: 'sport',
  },
  {
    id: 'geo-2',
    prompt: 'Stolicą którego kraju jest Lizbona?',
    options: [
      { id: 'a', text: 'Hiszpanii' },
      { id: 'b', text: 'Włoch' },
      { id: 'c', text: 'Portugalii' },
      { id: 'd', text: 'Grecji' },
    ],
    correctOptionId: 'c',
    category: 'geografia',
  },
];
