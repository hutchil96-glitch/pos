import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import productsRouter from "./products";
import stockRouter from "./stock";
import salesRouter from "./sales";
import shiftsRouter from "./shifts";
import costsRouter from "./costs";
import payrollRouter from "./payroll";
import promotionsRouter from "./promotions";
import auditRouter from "./audit";
import dashboardRouter from "./dashboard";
import sheetsRouter from "./sheets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(productsRouter);
router.use(stockRouter);
router.use(salesRouter);
router.use(shiftsRouter);
router.use(costsRouter);
router.use(payrollRouter);
router.use(promotionsRouter);
router.use(auditRouter);
router.use(dashboardRouter);
router.use(sheetsRouter);

export default router;
