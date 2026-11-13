# Fluxo Queue Compass

Crie um sistema web completo para gerenciamento de filas e emissão de senhas para atendimento presencial.
Regra importante: não utilizar tela de login

O sistema não deve possuir tela de login, cadastro de usuários, senha de acesso ou autenticação obrigatória.

Todas as telas devem estar disponíveis diretamente por meio de um menu inicial simples, com opções como:

Totem de emissão de senha

Painel público

Recepção

Raio-X

Tomografia

Setor de coleta

Administração

Relatórios

Ao acessar a tela de atendimento, o funcionário poderá selecionar diretamente:

O setor em que está trabalhando.

O guichê, sala ou posição de atendimento.

O tipo de fila que deseja visualizar.

Exemplo:

O atendente abre a tela Recepção.

Seleciona Guichê 01.

Começa a chamar as senhas.

Outro exemplo:

O funcionário abre a tela Tomografia.

Seleciona Sala 02.

Visualiza e chama os pacientes encaminhados para esse setor.

Não criar:

Tela de login.

Tela de cadastro de usuários.

Campo obrigatório de e-mail.

Campo obrigatório de senha.

Perfis de usuários com autenticação.

Bloqueio de acesso por login.

Redirecionamento para página de autenticação.

O sistema deve ser simples e funcionar imediatamente em uma rede interna da clínica ou unidade de atendimento.

A área administrativa também deve ser acessível diretamente pelo menu principal, sem exigir login. Nela, o administrador poderá configurar:

Nome da unidade.

Logotipo.

Setores.

Guichês.

Salas.

Tipos de senha.

Numeração das senhas.

Regras de encaminhamento.

Volume e velocidade da voz.

Textos exibidos no painel.

Configurações das filas.

Caso seja necessário identificar o atendente, utilizar apenas um campo opcional para informar o nome, sem senha e sem autenticação obrigatória.

Correção adicional sobre o número da senha

O número 421 não é o nome do sistema, não é uma marca e não deve aparecer fixo na interface. Ele foi utilizado apenas como exemplo de chamada.

O sistema deve permitir configurar diferentes formatos de senha, como:

001

A001

RX001

COL001

A numeração deve ser gerada automaticamente e configurável pelo administrador.

Fluxo principal esperado

O sistema deve funcionar da seguinte maneira:

O paciente emite uma senha no totem.

A recepção chama a senha.

A recepção atende o paciente.

O atendente pode encaminhá-lo para um ou mais setores, como:

Raio-X.

Tomografia.

Setor de coleta.

O sistema cria ou direciona a senha para a fila do primeiro setor.

O setor chama o paciente.

O painel público exibe a senha e o local de atendimento.

O sistema anuncia por voz, por exemplo:

“Senha A001, compareça ao Raio-X.”

“Senha B014, compareça à Tomografia.”

“Senha C022, compareça ao setor de coleta.”

Após concluir o atendimento, o paciente pode ser direcionado automaticamente para o próximo setor.

O sistema registra todo o histórico até a conclusão do atendimento.

Mantenha todas as outras funcionalidades do prompt anterior, mas retire completamente a autenticação e qualquer tela de login.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://fluxo-queue-compass.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/560b6d3b-2ce7-4a0b-a15b-4273c6e6f99a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
