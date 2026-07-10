# Trilhas originais do SmartCorretorAI

As cinco faixas deste diretório são instrumentais originais sintetizadas localmente para o SmartCorretorAI. Elas não contêm samples, gravações ou obras de terceiros e podem ser usadas comercialmente pelo projeto.

Cada asset tem 60 segundos, áudio AAC, 48 kHz e dois canais. A normalização e os fades de entrada e saída são aplicados somente no merge final, de acordo com a duração efetiva do vídeo.

Arquivos:

- `moderna.m4a`
- `calma.m4a`
- `sofisticada.m4a`
- `animada.m4a`
- `instrumental.m4a`

O script `generate-original-tracks.mjs` reproduz os assets usando apenas síntese do FFmpeg. A geração acontece no desenvolvimento; o worker nunca baixa nem gera música durante um job.
