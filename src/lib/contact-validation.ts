export function validateContact(form: FormData) {
  const name=String(form.get('name')??'').trim(), email=String(form.get('email')??'').trim().toLowerCase(), phone=String(form.get('phone')??'').trim(), message=String(form.get('message')??'').trim();
  if(name.length<2||name.length>100) throw new Error('Indiquez votre nom (2 à 100 caractères).');
  if(email.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error('Indiquez une adresse email valide.');
  if(phone&&!/^\+?[\d\s().-]{8,30}$/.test(phone)) throw new Error('Vérifiez votre numéro de téléphone.');
  if(message.length<10||message.length>4000) throw new Error('Votre message doit contenir entre 10 et 4 000 caractères.');
  const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  return {name,email,phone,message,html:`<h1>Message reçu depuis Come &amp; Eat</h1><p>Nom : ${escape(name)}</p><p>Email : ${escape(email)}</p><p>Téléphone : ${escape(phone)}</p><p style="white-space:pre-wrap">${escape(message)}</p>`,text:`Message reçu depuis Come & Eat\nNom : ${name}\nEmail : ${email}\nTéléphone : ${phone}\n\n${message}`};
}
