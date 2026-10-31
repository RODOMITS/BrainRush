import fs from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('./demo-config.js', import.meta.url), 'utf8')+'\nglobalThis.catalog=CONFIG;', context);
export const catalog = JSON.parse(JSON.stringify(context.catalog));
export const cents = n => Math.round(n * 100);
export const acceptedNames = `Strawberry Elephant|Pollaroidini|Signore Carapace|Meowl|Orchidox|John Pork|Skibidi Toilet|Elefanto frigo|Arcadragon|Griffin|Love Love Bear|Antonio|Los Dragons|Dragon Gingerini|Dragon Aquanini|Phoenix|Kalika Bros|Fishino Clownino|La Supreme Combinasion|Digi Narwhal|Kraken|Ginger Gerat|Hydra Bunny|Moby Bros|Tirilikalika Tirilikalako|Hydra Dragon Cannelloni|Jelly Moby|Pancake and Syrup|Dragon Cannelloni|Grabatron|Sammyni Cakini|Ketupat Bros|Venuspino|La Casa Boo|Bumbatron|Hydra Serpent|Los Secret Combinasionas|Foxini Lanternini|Rosey and Teddy|Sammyni Trackini|Rubiko and Kubiko|Los Admins|Los Sekolahs|Duggy Bros|Sammyni Spookyni|Dug dug dug|La Breakfast Combinasion|Rubrikiko|Quackini Snackini|Los Hackers|Guest 666|Reinito Sleighito|La Fuse Machine|Globa Steppa|Cerberus|Fragrama and Chocrama|Fortunu and Cashuru|La Craft Machine|Spooky and Pumpky|Sammyni Fattini|Cooki and Milki|Capitano Moby|Boppin Bunny|La Food Combinasion|Celestial Pegasus|Festive 67|Popcuru and Fizzuru|Burguro And Fryuro|Garama and Madundung`.split('|');
export const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const withdrawNames = ['Garama and Madundung','Dragon Cannelloni'];
