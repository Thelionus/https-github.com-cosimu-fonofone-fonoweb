import Vue from 'vue';

export default {
  template: `
    <div class="module">
        <main>
          <slot></slot>
        </main>
        <footer>
          <slot name="footer"></slot>
        </footer>
    </div>
  `
};
